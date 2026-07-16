const { Events, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const embeds = require('../utils/embeds'); 

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. DROPDOWN HANDLER (String Select Menus)
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            try {
                // Instantly defer to prevent "interaction failed"
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});

                const rawValue = interaction.values[0]; // e.g., 'join_firstOfficer'
                const userId = interaction.user.id;
                const messageId = interaction.message.id;
                
                // Strip prefix if present
                const roleKey = rawValue.replace('join_', ''); 

                // Find the sheet in MongoDB
                const allocation = await Allocation.findOne({ messageId });
                if (!allocation) {
                    return await interaction.editReply('❌ Flight allocation data not found in the database. Ensure this sheet is active.');
                }

                if (!allocation[roleKey]) allocation[roleKey] = [];
                if (!allocation.queues) allocation.queues = {};
                if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

                let roleLabel = roleKey;
                let maxSlots = 1;

                // Safely load configs from embeds.js
                if (embeds && typeof embeds.getRoleConfig === 'function') {
                    const roleConfig = embeds.getRoleConfig(roleKey);
                    if (roleConfig) {
                        roleLabel = roleConfig.label || roleKey;
                        maxSlots = roleConfig.max || 1;
                    }
                } else if (embeds && embeds.ROLES) {
                    const foundRole = embeds.ROLES.find(r => r.key === roleKey);
                    if (foundRole) {
                        roleLabel = foundRole.label || roleKey;
                        maxSlots = foundRole.max || 1;
                    }
                }

                const isAllocated = allocation[roleKey].includes(userId);
                const isInQueue = allocation.queues[roleKey].includes(userId);
                const flightNum = allocation.flight?.number || 'Unknown';

                // ==========================================
                // LEAVING: If they are allocated OR in queue
                // ==========================================
                if (isAllocated || isInQueue) {
                    
                    if (isAllocated) {
                        // 1. Remove from active slot
                        allocation[roleKey] = allocation[roleKey].filter(id => id !== userId);
                        
                        // 2. Promote the next person from queue if there is one
                        let promotedUser = null;
                        if (allocation.queues[roleKey].length > 0) {
                            const nextUserId = allocation.queues[roleKey].shift();
                            allocation[roleKey].push(nextUserId);
                            
                            // Fetch user object to send them a DM about being promoted
                            try {
                                promotedUser = await interaction.client.users.fetch(nextUserId);
                            } catch {}
                        }
                        
                        await allocation.save();
                        await interaction.editReply(`🔴 Removed you from **${roleLabel}**.`);

                        // DM: User who unallocated
                        await sendDM(interaction.user, `<:WP_x:1513933010267799716> You have unallocated from **${roleLabel}** for **${flightNum}**.`);

                        // DM: The user promoted from the queue (if any)
                        if (promotedUser) {
                            await sendDM(promotedUser, `<:WP_thumbsup:1513933060452651120> You have been allocated as **${roleLabel}** for **${flightNum}**.`);
                        }

                        // Log active removal
                        await sendLog(interaction, {
                            action: '🔴 De-allocated',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });

                    } else if (isInQueue) {
                        // 1. Simply remove them from the queue list
                        allocation.queues[roleKey] = allocation.queues[roleKey].filter(id => id !== userId);
                        
                        await allocation.save();
                        await interaction.editReply(`🔴 Removed you from the queue for **${roleLabel}**.`);

                        // DM: Left queue
                        await sendDM(interaction.user, `<:WP_x:1513933010267799716> You have left the queue for **${roleLabel}** on **${flightNum}**.`);

                        // Log queue removal
                        await sendLog(interaction, {
                            action: '🔴 Left Queue',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });
                    }

                } else {
                    // ==========================================
                    // JOINING: If they are not in either list
                    // ==========================================

                    if (allocation[roleKey].length < maxSlots) {
                        allocation[roleKey].push(userId);
                        await allocation.save();
                        await interaction.editReply(`✅ Allocated as **${roleLabel}**!`);

                        // DM: Allocated successfully
                        await sendDM(interaction.user, `<:WP_check:1513934023251198087> You have been allocated as **${roleLabel}** for **${flightNum}**.`);

                        // Send Log: Allocated
                        await sendLog(interaction, {
                            action: '🟢 Allocated',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });

                    } else {
                        // Try adding to queue if they aren't already there
                        if (!allocation.queues[roleKey].includes(userId)) {
                            allocation.queues[roleKey].push(userId);
                            await allocation.save();
                            await interaction.editReply(`⏳ Slot full! Added to the queue for **${roleLabel}**.`);

                            // DM: Added to Queue
                            await sendDM(interaction.user, `<:WP_telephone:1513933092811964557> The role **${roleLabel}** is full. You have been added to the queue.`);

                            // Send Log: Added to Queue
                            await sendLog(interaction, {
                                action: '⏳ Queue Joined',
                                user: interaction.user,
                                role: roleLabel,
                                flightNumber: flightNum,
                                messageId
                            });

                        } else {
                            await interaction.editReply(`<:WP_x:1513933010267799716> You are already in the waiting queue.`);
                        }
                    }
                }

                // Instantly re-render the embed layout
                if (embeds && typeof embeds.buildMainEmbed === 'function' && typeof embeds.buildButtons === 'function') {
                    await interaction.message.edit({
                        embeds: [embeds.buildMainEmbed(allocation.flight, allocation)],
                        components: embeds.buildButtons()
                    }).catch(err => console.error("Failed to edit flight embed:", err));
                }

            } catch (error) {
                console.error("❌ Allocation dropdown error:", error);
                await interaction.editReply('❌ Something went wrong while saving your selection.').catch(() => {});
            }
            return;
        }

        // ==========================================
        // 2. HANDLE SLASH COMMANDS
        // ==========================================
        if (!interaction.isChatInputCommand()) return;

        const personnelGuildId = process.env.PERSONNEL_GUILD_ID;

        if (interaction.guildId !== personnelGuildId) {
            return await interaction.reply({
                content: '⚠️ This command is restricted and cannot be used here.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            }
        }
    },
};

// Helper function to send direct messages safely
async function sendDM(user, messageText) {
    try {
        await user.send(messageText);
    } catch (err) {
        console.warn(`Could not DM user ${user.tag || user.id}: DMs are likely closed.`);
    }
}

// Helper function to process logs exactly like unallocate.js
async function sendLog(interaction, { action, user, role, flightNumber, messageId }) {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    try {
        const channel = await interaction.client.channels.fetch(logChannelId);
        await channel.send(`${action} | **Flight ${flightNumber}** | **${role}** | User: <@${user.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId})`);
    } catch (err) {
        console.warn('Could not send dropdown interaction log:', err.message);
    }
}