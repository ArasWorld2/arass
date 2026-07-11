const { Events, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons, getRoleConfig } = require('../utils/embeds');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. HANDLE DROPDOWN SELECTIONS (Role Allocation)
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            try {
                // Acknowledge the interaction privately
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                const roleKey = interaction.values[0]; // e.g., 'captain', 'first_officer'
                const userId = interaction.user.id;
                const messageId = interaction.message.id;

                // 1. Find the flight sheet in the database
                const allocation = await Allocation.findOne({ messageId });
                if (!allocation) {
                    return await interaction.editReply('❌ Flight allocation sheet data not found in database.');
                }

                // Initialize role configurations if not existing
                if (!allocation[roleKey]) allocation[roleKey] = [];
                if (!allocation.queues) allocation.queues = {};
                if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

                // 2. Fetch role configuration limits (e.g. Max slots)
                const roleConfig = getRoleConfig ? getRoleConfig(roleKey) : null;
                const maxSlots = roleConfig?.max || 4; // Fallback to 4 or adapt to your embed configuration limits

                // 3. Handle allocation rules
                if (allocation[roleKey].includes(userId)) {
                    // If already allocated to this specific role, remove them (Toggle system)
                    allocation[roleKey] = allocation[roleKey].filter(id => id !== userId);
                    
                    // Promote someone from the queue if anyone is waiting
                    if (allocation.queues[roleKey].length > 0) {
                        const nextUser = allocation.queues[roleKey].shift();
                        allocation[roleKey].push(nextUser);
                    }
                    
                    await allocation.save();
                    await interaction.editReply(`🔴 Removed you from **${roleConfig?.label || roleKey}**.`);
                } else {
                    // Check if the slot is full
                    if (allocation[roleKey].length < maxSlots) {
                        allocation[roleKey].push(userId);
                        await allocation.save();
                        await interaction.editReply(`✅ You have been allocated as **${roleConfig?.label || roleKey}**!`);
                    } else {
                        // If full, add them to the waiting queue instead
                        if (!allocation.queues[roleKey].includes(userId)) {
                            allocation.queues[roleKey].push(userId);
                            await allocation.save();
                            await interaction.editReply(`⏳ Slot full! You have been added to the queue for **${roleConfig?.label || roleKey}**.`);
                        } else {
                            await interaction.editReply(`⚠️ You are already in the waiting queue for **${roleConfig?.label || roleKey}**.`);
                        }
                    }
                }

                // 4. Update the live message embed on Discord
                try {
                    await interaction.message.edit({
                        embeds: [buildMainEmbed(allocation.flight, allocation)],
                        components: buildButtons()
                    });
                } catch (editError) {
                    console.error("Failed to update display message components:", editError);
                }

            } catch (error) {
                console.error("❌ Error processing allocation dropdown:", error);
                await interaction.editReply('❌ Something went wrong while saving your selection. Check console logs.').catch(() => {});
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