const { Events, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
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

                // Find the sheet in MongoDB
                const allocation = await Allocation.findOne({ messageId });
                if (!allocation) {
                    return await interaction.reply({
                        content: '❌ Flight allocation data not found in the database. Ensure this sheet is active.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                // Initialize empty properties safely if they don't exist
                if (!allocation[roleKey]) allocation[roleKey] = [];
                if (!allocation.queues) allocation.queues = {};
                if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

                // Safely load configs from embeds.js to get the pretty role name for logs
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

                // 🔒 EXPLICIT LOCK INTERCEPT ENGINE
                if (allocation.isLocked === true) {
                    let holdsAnyPosition = false;
                    const docData = allocation.toObject();

                    // Scan all top-level array fields for the user's ID
                    for (const key in docData) {
                        if (Array.isArray(docData[key]) && docData[key].includes(userId)) {
                            holdsAnyPosition = true;
                            break;
                        }
                    }

                    // Scan all nested queue maps/objects for the user's ID
                    if (!holdsAnyPosition && docData.queues) {
                        for (const queueKey in docData.queues) {
                            if (Array.isArray(docData.queues[queueKey]) && docData.queues[queueKey].includes(userId)) {
                                holdsAnyPosition = true;
                                break;
                            }
                        }
                    }

                    // Block them instantly if they already have a presence on this sheet
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

                // Defer the reply now that the safety lock verification passed
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});

                // ==========================================
                // LEAVING PROCESS
                // ==========================================
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

                        await sendDM(interaction.user, `<:WP_x:1513933010267799716> You have unallocated from **${roleLabel}** for **${flightNum}**.`);

                        if (promotedUser) {
                            await sendDM(promotedUser, `<:WP_thumbsup:1513933060452651120> You have been allocated as **${roleLabel}** for **${flightNum}**.`);
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

                        await sendDM(interaction.user, `<:WP_x:1513933010267799716> You have left the queue for **${roleLabel}** on **${flightNum}**.`);

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
                    // JOINING PROCESS
                    // ==========================================
                    if (allocation[roleKey].length < maxSlots) {
                        allocation[roleKey].push(userId);
                        await allocation.save();
                        await interaction.editReply(`✅ Allocated as **${roleLabel}**!`);

                        await sendDM(interaction.user, `<:WP_check:1513934023251198087> You have been allocated as **${roleLabel}** for **${flightNum}**.`);

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

                            await sendDM(interaction.user, `<:WP_telephone:1513933092811964557> The role **${roleLabel}** is full. You have been added to the queue.`);

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
        // 2. HANDLE LOA MODAL SUBMISSIONS
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
                    return await interaction.reply({ content: '❌ Invalid date layout. Please make sure to format it strictly as **DD/MM/YYYY**.', flags: [MessageFlags.Ephemeral] });
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
                    .setColor('#f1c40f')
                    .setTitle('📋 New Leave of Absence Request')
                    .addFields(
                        { name: 'User', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: false },
                        { name: 'Duration', value: `📆 **From:** ${startStr}\n📆 **To:** ${endStr}`, inline: true },
                        { name: 'Reason', value: `\`\`\`${reason}\`\`\``, inline: false }
                    )
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`loa_approve_${loaRecord._id}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`loa_deny_${loaRecord._id}`).setLabel('❌ Deny').setStyle(ButtonStyle.Danger)
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
        // 3. HANDLE LOA APPROVAL/DENIAL BUTTONS
        // ==========================================
        if (interaction.isButton() && interaction.customId.startsWith('loa_')) {
            if (!interaction.member.permissions.has('ManageMessages')) {
                return await interaction.reply({ content: '🚫 You lack permission to manage LOA records.', flags: [MessageFlags.Ephemeral] });
            }

            const parts = interaction.customId.split('_');
            const action = parts[1]; // approve or deny
            const recordId = parts[2];
            
            const loaRecord = await Loa.findById(recordId);

            if (!loaRecord || loaRecord.status !== 'PENDING') {
                return await interaction.reply({ content: '❌ This LOA request has already been processed or does not exist.', flags: [MessageFlags.Ephemeral] });
            }

            const targetUser = await interaction.client.users.fetch(loaRecord.userId).catch(() => null);

            if (action === 'approve') {
                loaRecord.status = 'APPROVED';
                
                const guildId = process.env.GUILD_ID;
                const loaRoleId = process.env.LOA_ROLE_ID;
                const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
                
                const now = new Date();
                let appliedInstantly = false;

                // 🌟 DUAL-ACTION LAYER: If the start date is today or has passed, give it instantly
                if (guild && loaRecord.startDate <= now) {
                    const member = await guild.members.fetch(loaRecord.userId).catch(() => null);
                    if (member && loaRoleId) {
                        await member.roles.add(loaRoleId).catch(err => console.error(`Failed to assign instant LOA role: ${err.message}`));
                        loaRecord.roleApplied = true;
                        appliedInstantly = true;
                    }
                }

                await loaRecord.save();

                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#2ecc71')
                    .setTitle('✅ LOA Approved')
                    .setFooter({ text: `Approved by ${interaction.user.tag}` });

                await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
                
                if (targetUser) {
                    const msg = appliedInstantly 
                        ? `🟢 **Your Leave of Absence Request has been APPROVED.** Your status roles have been updated instantly.`
                        : `🟢 **Your Leave of Absence Request has been APPROVED.** Your status role configuration will apply automatically on your scheduled start date.`;
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

                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#e74c3c')
                    .setTitle('❌ LOA Denied')
                    .setFooter({ text: `Denied by ${interaction.user.tag}` });

                await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
                if (targetUser) await targetUser.send(`🔴 **Your Leave of Absence Request has been DENIED.** Please check in with management for clarification.`).catch(() => {});
                return await interaction.reply({ content: '❌ LOA set to denied status.', flags: [MessageFlags.Ephemeral] });
            }
        }

        // ==========================================
        // 4. HANDLE SLASH COMMANDS
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
            console.error(`Error executing ${interaction.commandName}:`, error);
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