const { Events, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Allocation = require('../models/Allocation');
const Loa = require('../models/Loa');
const embeds = require('../utils/embeds'); 

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 0. AUTOCOMPLETE DISPATCHER
        // ==========================================
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`Error handling autocomplete for /${interaction.commandName}:`, error);
            }
            return;
        }

        // ==========================================
        // 1. DROPDOWN HANDLER (String Select Menus)
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            try {
                const userId = interaction.user.id;
                const messageId = interaction.message.id;
                const rawValue = interaction.values[0]; 

                const allocation = await Allocation.findOne({ messageId });
                if (!allocation) {
                    return await interaction.reply({
                        content: '❌ Flight allocation data not found in the database. Ensure this sheet is active.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                // --- Handle "Leave Shift" / Unallocate Option ---
                if (rawValue === 'alloc_unallocate' || rawValue === 'join_unallocate') {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});
                    let unallocatedAny = false;

                    // Remove user from all assigned role arrays
                    const docData = allocation.toObject();
                    for (const key in docData) {
                        if (Array.isArray(allocation[key]) && allocation[key].includes(userId)) {
                            allocation[key] = allocation[key].filter(id => id !== userId);
                            unallocatedAny = true;

                            // Promote next candidate from queue if available
                            if (allocation.queues && allocation.queues[key] && allocation.queues[key].length > 0) {
                                const nextUserId = allocation.queues[key].shift();
                                allocation[key].push(nextUserId);
                                try {
                                    const promotedUser = await interaction.client.users.fetch(nextUserId);
                                    await sendDM(promotedUser, `You have been allocated to your queued role for **${allocation.flight?.number || 'Flight'}**.`);
                                } catch {}
                            }
                        }
                    }

                    // Remove user from all waiting queues
                    if (allocation.queues) {
                        for (const qKey in allocation.queues) {
                            if (Array.isArray(allocation.queues[qKey]) && allocation.queues[qKey].includes(userId)) {
                                allocation.queues[qKey] = allocation.queues[qKey].filter(id => id !== userId);
                                unallocatedAny = true;
                            }
                        }
                    }

                    await allocation.save();

                    // Refresh flight sheet embed
                    if (embeds && typeof embeds.buildMainEmbed === 'function' && typeof embeds.buildButtons === 'function') {
                        await interaction.message.edit({
                            embeds: [embeds.buildMainEmbed(allocation.flight, allocation)],
                            components: embeds.buildButtons()
                        }).catch(err => console.error("Failed to edit flight embed:", err));
                    }

                    return await interaction.editReply(unallocatedAny ? '🔴 You have successfully left your assigned shifts/queues.' : '⚠️ You are not currently allocated to any role on this flight.');
                }

                // Extract clean role key (strips 'alloc_' or 'join_')
                const roleKey = rawValue.replace(/^alloc_|^join_/, ''); 

                if (!allocation[roleKey]) allocation[roleKey] = [];
                if (!allocation.queues) allocation.queues = {};
                if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

                let roleLabel = roleKey;
                let maxSlots = 1;

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

                if (allocation.isLocked === true) {
                    let holdsAnyPosition = false;
                    const docData = allocation.toObject();

                    for (const key in docData) {
                        if (Array.isArray(docData[key]) && docData[key].includes(userId)) {
                            holdsAnyPosition = true;
                            break;
                        }
                    }

                    if (!holdsAnyPosition && docData.queues) {
                        for (const queueKey in docData.queues) {
                            if (Array.isArray(docData.queues[queueKey]) && docData.queues[queueKey].includes(userId)) {
                                holdsAnyPosition = true;
                                break;
                            }
                        }
                    }

                    if (holdsAnyPosition) {
                        await sendLog(interaction, {
                            action: '🔒 Allocation Blocked (Locked Sheet)',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });

                        return await interaction.reply({
                            content: '🔒 **Allocation Locked:** This flight sheet has been locked by administration. You cannot leave your role or switch positions at this time.',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                }

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});

                if (isAllocated || isInQueue) {
                    if (isAllocated) {
                        allocation[roleKey] = allocation[roleKey].filter(id => id !== userId);
                        
                        let promotedUser = null;
                        if (allocation.queues[roleKey].length > 0) {
                            const nextUserId = allocation.queues[roleKey].shift();
                            allocation[roleKey].push(nextUserId);
                            
                            try {
