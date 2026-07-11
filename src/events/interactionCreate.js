const { Events, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const embeds = require('../utils/embeds'); // Import everything as an object safely

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. DROPDOWN HANDLER (String Select Menus)
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'allocate_role' || interaction.customId.includes('allocate')) {
                try {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                    const rawValue = interaction.values[0]; 
                    const userId = interaction.user.id;
                    const messageId = interaction.message.id;
                    const roleKey = rawValue.replace('join_', ''); 

                    const allocation = await Allocation.findOne({ messageId });
                    if (!allocation) {
                        return await interaction.editReply('❌ Flight allocation data not found in the database.');
                    }

                    if (!allocation[roleKey]) allocation[roleKey] = [];
                    if (!allocation.queues) allocation.queues = {};
                    if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

                    // Safe config extraction to prevent crash if getRoleConfig doesn't exist
                    let roleLabel = roleKey;
                    let maxSlots = 1;

                    if (embeds && typeof embeds.getRoleConfig === 'function') {
                        const roleConfig = embeds.getRoleConfig(roleKey);
                        if (roleConfig) {
                            roleLabel = roleConfig.label || roleKey;
                            maxSlots = roleConfig.max || 1;
                        }
                    } else if (embeds && embeds.ROLES) {
                        // Fallback fallback if ROLES array is available instead
                        const foundRole = embeds.ROLES.find(r => r.key === roleKey);
                        if (foundRole) {
                            roleLabel = foundRole.label || roleKey;
                            maxSlots = foundRole.max || 1;
                        }
                    }

                    // Allocation / De-allocation Toggle Logic
                    if (allocation[roleKey].includes(userId)) {
                        allocation[roleKey] = allocation[roleKey].filter(id => id !== userId);
                        
                        if (allocation.queues[roleKey].length > 0) {
                            const nextUser = allocation.queues[roleKey].shift();
                            allocation[roleKey].push(nextUser);
                        }
                        
                        await allocation.save();
                        await interaction.editReply(`🔴 Removed you from **${roleLabel}**.`);
                    } else {
                        // Anti-double-booking
                        for (const key in allocation.toObject()) {
                            if (Array.isArray(allocation[key]) && allocation[key].includes(userId) && key !== 'queues') {
                                allocation[key] = allocation[key].filter(id => id !== userId);
                            }
                        }

                        if (allocation[roleKey].length < maxSlots) {
                            allocation[roleKey].push(userId);
                            await allocation.save();
                            await interaction.editReply(`✅ Allocated as **${roleLabel}**!`);
                        } else {
                            if (!allocation.queues[roleKey].includes(userId)) {
                                allocation.queues[roleKey].push(userId);
                                await allocation.save();
                                await interaction.editReply(`⏳ Slot full! Added to the queue for **${roleLabel}**.`);
                            } else {
                                await interaction.editReply(`⚠️ You are already in the waiting queue.`);
                            }
                        }
                    }

                    // Safe refresh
                    if (embeds && typeof embeds.buildMainEmbed === 'function' && typeof embeds.buildButtons === 'function') {
                        await interaction.message.edit({
                            embeds: [embeds.buildMainEmbed(allocation.flight, allocation)],
                            components: embeds.buildButtons()
                        }).catch(err => console.error("Failed to edit flight embed:", err));
                    }

                } catch (error) {
                    console.error("❌ Allocation dropdown error:", error);
                    await interaction.editReply('❌ An error occurred processing your assignment.').catch(() => {});
                }
                return;
            }
        }

        // ==========================================
        // 2. SLASH COMMAND HANDLER
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
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            }
        }
    },
};