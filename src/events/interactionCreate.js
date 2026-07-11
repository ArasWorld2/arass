const { Events, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons, getRoleConfig } = require('../utils/embeds');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. DROPDOWN HANDLER (String Select Menus)
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            
            // ROUTE A: Flight Role Allocation Dropdown
            // Checks if the dropdown customId matches your flight sheet menu identifier
            if (interaction.customId === 'allocate_role' || interaction.customId.includes('allocate')) {
                try {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                    const rawValue = interaction.values[0]; // e.g., 'join_firstOfficer'
                    const userId = interaction.user.id;
                    const messageId = interaction.message.id;
                    const roleKey = rawValue.replace('join_', ''); 

                    const allocation = await Allocation.findOne({ messageId });
                    if (!allocation) {
                        return await interaction.editReply('❌ Flight allocation data not found in the database.');
                    }

                    // Initialize array fields if missing
                    if (!allocation[roleKey]) allocation[roleKey] = [];
                    if (!allocation.queues) allocation.queues = {};
                    if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

                    const roleConfig = typeof getRoleConfig === 'function' ? getRoleConfig(roleKey) : null;
                    const maxSlots = roleConfig?.max || 1; 

                    // TOGGLE LOGIC: If already signed up, remove them
                    if (allocation[roleKey].includes(userId)) {
                        allocation[roleKey] = allocation[roleKey].filter(id => id !== userId);
                        
                        if (allocation.queues[roleKey].length > 0) {
                            const nextUser = allocation.queues[roleKey].shift();
                            allocation[roleKey].push(nextUser);
                        }
                        
                        await allocation.save();
                        await interaction.editReply(`🔴 Removed you from **${roleConfig?.label || roleKey}**.`);
                    } else {
                        // Anti-double-booking: Remove user from any other role on this same flight sheet
                        for (const key in allocation.toObject()) {
                            if (Array.isArray(allocation[key]) && allocation[key].includes(userId) && key !== 'queues') {
                                allocation[key] = allocation[key].filter(id => id !== userId);
                            }
                        }

                        // Add to role or queue up if full
                        if (allocation[roleKey].length < maxSlots) {
                            allocation[roleKey].push(userId);
                            await allocation.save();
                            await interaction.editReply(`✅ Allocated as **${roleConfig?.label || roleKey}**!`);
                        } else {
                            if (!allocation.queues[roleKey].includes(userId)) {
                                allocation.queues[roleKey].push(userId);
                                await allocation.save();
                                await interaction.editReply(`⏳ Slot full! Added to the queue for **${roleConfig?.label || roleKey}**.`);
                            } else {
                                await interaction.editReply(`⚠️ You are already in the waiting queue.`);
                            }
                        }
                    }

                    // Live update the original message embed layout
                    await interaction.message.edit({
                        embeds: [buildMainEmbed(allocation.flight, allocation)],
                        components: buildButtons()
                    }).catch(err => console.error("Failed to edit flight embed:", err));

                } catch (error) {
                    console.error("❌ Allocation dropdown error:", error);
                    await interaction.editReply('❌ An error occurred processing your assignment.').catch(() => {});
                }
                return;
            }

            // ROUTE B: Future Custom Dropdowns
            // You can easily add more 'else if' blocks right here for future select menus!
            // else if (interaction.customId === 'your_future_dropdown') { ... }
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