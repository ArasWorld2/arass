const { Events, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Allocation = require('../models/Allocation');
const Loa = require('../models/Loa');
const embeds = require('../utils/embeds'); 

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. DROPDOWN HANDLER (String Select Menus)
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            try {
                const userId = interaction.user.id;
                const messageId = interaction.message.id;
                const rawValue = interaction.values[0]; 
                const roleKey = rawValue.replace('join_', ''); 

                const allocation = await Allocation.findOne({ messageId });
                if (!allocation) {
                    return await interaction.reply({
                        content: '❌ Flight allocation data not found in the database. Ensure this sheet is active.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

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
                                promotedUser = await interaction.client.users.fetch(nextUserId);
                            } catch {}
                        }
                        
                        await allocation.save();
                        await interaction.editReply(`🔴 Removed you from **${roleLabel}**.`);
                        await sendDM(interaction.user, `You have unallocated from **${roleLabel}** for **${flightNum}**.`);

                        if (promotedUser) {
                            await sendDM(promotedUser, `You have been allocated as **${roleLabel}** for **${flightNum}**.`);
                        }

                        await sendLog(interaction, {
                            action: '🔴 De-allocated',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });

                    } else if (isInQueue) {
                        allocation.queues[roleKey] = allocation.queues[roleKey].filter(id => id !== userId);
                        
                        await allocation.save();
                        await interaction.editReply(`🔴 Removed you from the queue for **${roleLabel}**.`);
                        await sendDM(interaction.user, `You have left the queue for **${roleLabel}** on **${flightNum}**.`);

                        await sendLog(interaction, {
                            action: '🔴 Left Queue',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });
                    }

                } else {
                    if (allocation[roleKey].length < maxSlots) {
                        allocation[roleKey].push(userId);
                        await allocation.save();
                        await interaction.editReply(`✅ Allocated as **${roleLabel}**!`);
                        await sendDM(interaction.user, `You have been allocated as **${roleLabel}** for **${flightNum}**.`);

                        await sendLog(interaction, {
                            action: '🟢 Allocated',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });

                    } else {
                        if (!allocation.queues[roleKey].includes(userId)) {
                            allocation.queues[roleKey].push(userId);
                            await allocation.save();
                            await interaction.editReply(`⏳ Slot full! Added to the queue for **${roleLabel}**.`);
                            await sendDM(interaction.user, `The role **${roleLabel}** is full. You have been added to the queue.`);

                            await sendLog(interaction, {
                                action: '⏳ Queue Joined',
                                user: interaction.user,
                                role: roleLabel,
                                flightNumber: flightNum,
                                messageId
                            });

                        } else {
                            await interaction.editReply(`You are already in the waiting queue.`);
                        }
                    }
                }

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
        // 2. HANDLE LOA INITIAL MODAL SUBMISSIONS
        // ==========================================
        if (interaction.isModalSubmit() && interaction.customId === 'loa_modal') {
            try {
                const startStr = interaction.fields.getTextInputValue('loa_start');
                const endStr = interaction.fields.getTextInputValue('loa_end');
                const reason = interaction.fields.getTextInputValue('loa_reason');

                const parseDate = (str) => {
                    const parts = str.split('/');
                    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
                };

                const startDate = parseDate(startStr);
                const endDate = parseDate(endStr);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return await interaction.reply({ content: '❌ Invalid date layout. Please format strictly as **DD/MM/YYYY**.', flags: [MessageFlags.Ephemeral] });
                }

                if (endDate <= startDate) {
                    return await interaction.reply({ content: '❌ Your end date must fall completely after your start date.', flags: [MessageFlags.Ephemeral] });
                }

                const requestLogChannelId = process.env.LOA_LOG_CHANNEL_ID;
                const reviewChannel = await interaction.client.channels.fetch(requestLogChannelId).catch(() => null);
                
                if (!reviewChannel) {
                    return await interaction.reply({ content: '❌ LOA system channel configuration error. Please inform administration.', flags: [MessageFlags.Ephemeral] });
                }

                const loaRecord = await Loa.create({
                    userId: interaction.user.id,
                    startDate,
                    endDate,
                    reason
                });

                const reviewEmbed = new EmbedBuilder()
                    .setColor('#d3007f')
                    .setTitle('New Leave of Absence Request')
                    .setDescription(`┃ User: <@${interaction.user.id}>\n┃ From: ${startStr}\n┃ To: ${endStr}\n\nReason Given\n┃ \`${reason}\``)
                    .setFooter({ text: '© Wizz Air' })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`loa_approve_${loaRecord._id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`loa_deny_${loaRecord._id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
                );

                const reviewMessage = await reviewChannel.send({ embeds: [reviewEmbed], components: [row] });
                
                loaRecord.reviewMessageId = reviewMessage.id;
                await loaRecord.save();

                return await interaction.reply({ content: '✅ Your LOA request has been successfully forwarded to management for review.', flags: [MessageFlags.Ephemeral] });

            } catch (err) {
                console.error(err);
                return await interaction.reply({ content: '❌ Something went wrong saving your request.', flags: [MessageFlags.Ephemeral] });
            }
        }

        // ==========================================
        // 3. HANDLE LOA END DATE MODAL SUBMISSION
        // ==========================================
        if (interaction.isModalSubmit() && interaction.customId.startsWith('loa_editmodal_')) {
            try {
                const recordId = interaction.customId.split('_')[2];
                const newEndStr = interaction.fields.getTextInputValue('loa_new_end');
                
                const parts = newEndStr.split('/');
                const newEndDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);

                if (isNaN(newEndDate.getTime())) {
                    return await interaction.reply({ content: '❌ Invalid date layout. Please format strictly as DD/MM/YYYY.', flags: [MessageFlags.Ephemeral] });
                }

                const loaRecord = await Loa.findById(recordId);
                if (!loaRecord) return await interaction.reply({ content: '❌ Record not found.', flags: [MessageFlags.Ephemeral] });

                if (newEndDate <= loaRecord.startDate) {
                    return await interaction.reply({ content: '❌ New end date must fall completely after the start date.', flags: [MessageFlags.Ephemeral] });
                }

                loaRecord.endDate = newEndDate;
                if (loaRecord.status === 'EXPIRED') {
                    loaRecord.status = 'APPROVED';
                    loaRecord.roleRemoved = false;
                }
                await loaRecord.save();

                const formatDateStr = (dateObj) => {
                    const d = new Date(dateObj);
                    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                };

                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setDescription(`┃ This leave request has been approved.\n\nMember\n┃ <@${loaRecord.userId}>\n\nApproved Dates (Modified)\n┃ ${formatDateStr(loaRecord.startDate)} to ${formatDateStr(loaRecord.endDate)}\n\nReason Given\n┃ \`${loaRecord.reason}\``);

                await interaction.message.edit({ embeds: [updatedEmbed] });
                return await interaction.reply({ content: '✅ Leave of absence expiration window adjusted successfully.', flags: [MessageFlags.Ephemeral] });

            } catch (err) {
                console.error(err);
                return await interaction.reply({ content: '❌ Error processing date shift.', flags: [MessageFlags.Ephemeral] });
            }
        }

        // ==========================================
        // 4. HANDLE LOA MANAGEMENT ACTION BUTTONS
        // ==========================================
        if (interaction.isButton() && interaction.customId.startsWith('loa_')) {
            if (!interaction.member.permissions.has('ManageMessages')) {
                return await interaction.reply({ content: '🚫 You lack permission to manage LOA records.', flags: [MessageFlags.Ephemeral] });
            }

            const parts = interaction.customId.split('_');
            const action = parts[1]; 
            const recordId = parts[2];
            
            const loaRecord = await Loa.findById(recordId);
            if (!loaRecord) return await interaction.reply({ content: '❌ LOA record not found.', flags: [MessageFlags.Ephemeral] });

            const targetUser = await interaction.client.users.fetch(loaRecord.userId).catch(() => null);

            const formatDateStr = (dateObj) => {
                const d = new Date(dateObj);
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            };

            if (action === 'approve') {
                loaRecord.status = 'APPROVED';
                
                const personnelGuildId = process.env.PERSONNEL_GUILD_ID;
                const loaRoleId = process.env.LOA_ROLE_ID;
                
                const personnelGuild = await interaction.client.guilds.fetch(personnelGuildId).catch((err) => {
                    console.error(`[LOA Critical Fetch Error] Could not find Personnel Server: ${err.message}`);
                    return null;
                });
                
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const startMidnight = new Date(loaRecord.startDate.getFullYear(), loaRecord.startDate.getMonth(), loaRecord.startDate.getDate());
                
                let appliedInstantly = false;

                if (personnelGuild && startMidnight <= todayMidnight) {
                    const member = await personnelGuild.members.fetch(loaRecord.userId).catch(() => null);
                    
                    if (member && loaRoleId) {
                        const role = await personnelGuild.roles.fetch(loaRoleId).catch(() => null);
                        if (role) {
                            await member.roles.add(role)
                                .then(() => {
                                    loaRecord.roleApplied = true;
                                    appliedInstantly = true;
                                })
                                .catch(err => console.error(`[LOA Role Add Error]: ${err.message}`));
                        }
                    }
                }

                await loaRecord.save();

                const updatedEmbed = new EmbedBuilder()
                    .setColor('#d3007f') 
                    .setTitle('Leave Approved')
                    .setDescription(`┃ This leave request has been approved by <@${interaction.user.id}>.\n\nMember\n┃ <@${loaRecord.userId}>\n\nApproved Dates\n┃ ${formatDateStr(loaRecord.startDate)} to ${formatDateStr(loaRecord.endDate)}\n\nReason Given\n┃ \`${loaRecord.reason}\``)
                    .setFooter({ text: '© Wizz Air' })
                    .setTimestamp();

                const managementRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`loa_editend_${loaRecord._id}`).setLabel('Edit End Date').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`loa_endearly_${loaRecord._id}`).setLabel('End Early').setStyle(ButtonStyle.Danger)
                );

                await interaction.message.edit({ embeds: [updatedEmbed], components: [managementRow] });
                
                if (targetUser) {
                    const msg = appliedInstantly 
                        ? `Your Leave of Absence Request has been APPROVED. Your status roles have been updated instantly.`
                        : `Your Leave of Absence Request has been APPROVED. Your status role configuration will apply automatically on your scheduled start date.`;
                    await targetUser.send(msg).catch(() => {});
                }

                return await interaction.reply({ 
                    content: appliedInstantly ? '✅ LOA approved and role added instantly.' : '✅ LOA approved. Role will apply automatically on the start date.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            if (action === 'deny') {
                loaRecord.status = 'DENIED';
                await loaRecord.save();

                const updatedEmbed = new EmbedBuilder()
                    .setColor('#e74c3c') 
                    .setTitle('Leave Denied')
                    .setDescription(`┃ This leave request has been denied by <@${interaction.user.id}>.\n\nMember\n┃ <@${loaRecord.userId}>\n\nRequested Dates\n┃ ${formatDateStr(loaRecord.startDate)} to ${formatDateStr(loaRecord.endDate)}\n\nReason Given\n┃ \`${loaRecord.reason}\``)
                    .setFooter({ text: '© Wizz Air' })
                    .setTimestamp();

                await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
                if (targetUser) await targetUser.send(`Your Leave of Absence Request has been DENIED. Please check in with management for clarification.`).catch(() => {});
                return await interaction.reply({ content: 'LOA set to denied status.', flags: [MessageFlags.Ephemeral] });
            }

            if (action === 'editend') {
                const modal = new ModalBuilder()
                    .setCustomId(`loa_editmodal_${recordId}`)
                    .setTitle('Modify Leave End Date');

                const newEndDateInput = new TextInputBuilder()
                    .setCustomId('loa_new_end')
                    .setLabel('New End Date (DD/MM/YYYY)')
                    .setPlaceholder('e.g. 05/08/2026')
                    .setMinLength(10)
                    .setMaxLength(10)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(newEndDateInput));
                return await interaction.showModal(modal);
            }

            if (action === 'endearly') {
                loaRecord.status = 'EXPIRED';
                loaRecord.roleRemoved = true;
                await loaRecord.save();

                const personnelGuildId = process.env.PERSONNEL_GUILD_ID;
                const loaRoleId = process.env.LOA_ROLE_ID;
                const personnelGuild = await interaction.client.guilds.fetch(personnelGuildId).catch(() => null);
                
                if (personnelGuild) {
                    const member = await personnelGuild.members.fetch(loaRecord.userId).catch(() => null);
                    if (member && loaRoleId) {
                        await member.roles.remove(loaRoleId).catch(err => console.error(`Failed to remove LOA role early: ${err.message}`));
                    }
                }

                const finishedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#e74c3c')
                    .setTitle('Leave Ended Early')
                    .setDescription(interaction.message.embeds[0].description + `\n\n🛑 **Status:** Terminated early by <@${interaction.user.id}>.`);

                await interaction.message.edit({ embeds: [finishedEmbed], components: [] });
                if (targetUser) await targetUser.send(`🛑 Your Leave of Absence has been terminated early by administration.`).catch(() => {});
                
                return await interaction.reply({ content: '✅ Leave of Absence successfully terminated early.', flags: [MessageFlags.Ephemeral] });
            }
        }

        // ==========================================
        // 5. CHAT COMMAND DISPATCHER
        // ==========================================
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing /${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            }
        }
    },
};

async function sendDM(user, messageText) {
    try {
        await user.send(messageText);
    } catch (err) {
        console.warn(`Could not DM user ${user.id}: DMs are closed.`);
    }
}

async function sendLog(interaction, { action, user, role, flightNumber, messageId }) {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    try {
        const channel = await interaction.client.channels.fetch(logChannelId);
        await channel.send(`${action} | **Flight ${flightNumber}** | Attempted Role: **${role}** | User: <@${user.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId})`);
    } catch (err) {
        console.warn('Could not send dropdown interaction log:', err.message);
    }
}