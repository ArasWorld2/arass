const { Events, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Allocation = require('../models/Allocation');
const Loa = require('../models/Loa');
const Profile = require('../models/Profile');
const embeds = require('../utils/embeds'); 

// Department Groups for Cross-Allocation Rules
const MAIN_DEPARTMENT_KEYS = [
    'dispatchCoordinator', 'dc', 'departureCoordinator',
    'dispatchSupervisor', 'flightSupervisor', 'mb', 'managementBoard',
    'captain', 'cpt',
    'firstOfficer', 'fo',
    'standbyFlightDeck', 'stbyFd',
    'purser',
    'cabinCrew', 'cc',
    'standbyCabinCrew', 'stbyCc',
    'tarmacSupervisor', 'ts',
    'groundHandling', 'groundCrew', 'gc',
    'standbyGroundCrew', 'stbyGc'
];

const AIRPORT_WORKER_KEYS = [
    'bagDropAgent', 'bcbd', 'businessClassBagDrop',
    'ecbd', 'economyClassBagDrop',
    'customerService', 'cs',
    'gateAgent', 'gate',
    'loungeAttendant', 'lounge'
];

// Dictionary mapping short menu keys to MongoDB schema property names
const KEY_ALIASES = {
    dc: ['dispatchCoordinator', 'dc', 'departureCoordinator', 'departure_coordinator', 'DC'],
    mb: ['dispatchSupervisor', 'flightSupervisor', 'mb', 'managementBoard', 'management_board'],
    cpt: ['captain', 'cpt', 'CPT'],
    fo: ['firstOfficer', 'fo', 'FO'],
    stbyFd: ['standbyFlightDeck', 'stbyFd', 'stby_fd', 'standby_flight_deck'],
    purser: ['purser', 'Purser'],
    cc: ['cabinCrew', 'cc', 'cabin_crew', 'CC'],
    stbyCc: ['standbyCabinCrew', 'stbyCc', 'stby_cc', 'standby_cabin_crew'],
    ts: ['tarmacSupervisor', 'ts', 'tarmac_supervisor'],
    gc: ['groundHandling', 'gc', 'groundCrew', 'ground_crew'],
    stbyGc: ['standbyGroundCrew', 'stbyGc', 'stby_gc', 'standby_ground_crew'],
    bcbd: ['bagDropAgent', 'bcbd', 'businessClassBagDrop'],
    ecbd: ['bagDropAgent', 'ecbd', 'economyClassBagDrop'],
    cs: ['cs', 'customerService', 'customer_service'],
    gate: ['gateAgent', 'gate', 'gate_agent'],
    lounge: ['loungeAttendant', 'lounge']
};

const ALL_SCHEMA_KEYS = Array.from(new Set(Object.values(KEY_ALIASES).flat()));

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

                // ------------------------------------------
                // A. HANDLE LEAVE SHIFT / UNALLOCATE
                // ------------------------------------------
                if (rawValue === 'alloc_unallocate' || rawValue === 'unallocate') {
                    if (allocation.isLocked === true) {
                        return await interaction.reply({
                            content: '🔒 **Allocation Locked:** This flight sheet has been locked by administration. You cannot leave your role at this time.',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});

                    let removedFromAny = false;
                    const removedRoles = [];
                    const promotedUsers = [];
                    const flightNum = allocation.flight?.number || 'Unknown Flight';

                    const getRoleLabel = (key) => {
                        if (embeds && typeof embeds.getRoleConfig === 'function') {
                            const config = embeds.getRoleConfig(key);
                            if (config && config.label) return config.label;
                        }
                        return key;
                    };

                    if (!allocation.queues) allocation.queues = {};

                    const checkAndPromote = async (matchedKey, schemaKey) => {
                        const possibleAliasKeys = [schemaKey, matchedKey, ...(KEY_ALIASES[schemaKey] || [])];
                        let queueKey = possibleAliasKeys.find(k => 
                            Array.isArray(allocation.queues[k]) && allocation.queues[k].length > 0
                        );

                        if (queueKey && allocation.queues[queueKey].length > 0) {
                            const nextUserId = allocation.queues[queueKey].shift();
                            allocation.markModified('queues');

                            if (Array.isArray(allocation[matchedKey])) {
                                allocation[matchedKey].push(nextUserId);
                                allocation.markModified(matchedKey);
                            } else {
                                allocation[schemaKey] = allocation[schemaKey] || [];
                                allocation[schemaKey].push(nextUserId);
                                allocation.markModified(schemaKey);
                            }

                            try {
                                const userObj = await interaction.client.users.fetch(nextUserId);
                                if (userObj) {
                                    promotedUsers.push({ user: userObj, roleLabel: getRoleLabel(schemaKey) });
                                }
                            } catch (err) {
                                console.warn(`Failed to fetch promoted candidate ${nextUserId}:`, err.message);
                            }
                        }
                    };

                    // 1. Wipe user across ALL mapped schema keys
                    for (const key of ALL_SCHEMA_KEYS) {
                        if (allocation[key] !== undefined && allocation[key] !== null) {
                            if (Array.isArray(allocation[key])) {
                                if (allocation[key].map(id => id.toString()).includes(userId)) {
                                    allocation[key] = allocation[key].filter(id => id.toString() !== userId);
                                    allocation.markModified(key);
                                    removedFromAny = true;
                                    const label = getRoleLabel(key);
                                    if (!removedRoles.includes(label)) removedRoles.push(label);

                                    await checkAndPromote(key, key);
                                }
                            } else if (allocation[key].toString() === userId) {
                                allocation[key] = [];
                                allocation.markModified(key);
                                removedFromAny = true;
                                const label = getRoleLabel(key);
                                if (!removedRoles.includes(label)) removedRoles.push(label);

                                await checkAndPromote(key, key);
                            }
                        }
                    }

                    // 2. Wipe user from all queues
                    if (allocation.queues) {
                        const queueKeys = Object.keys(allocation.queues.toObject ? allocation.queues.toObject() : allocation.queues);
                        queueKeys.forEach(key => {
                            if (Array.isArray(allocation.queues[key]) && allocation.queues[key].map(id => id.toString()).includes(userId)) {
                                allocation.queues[key] = allocation.queues[key].filter(id => id.toString() !== userId);
                                allocation.markModified('queues');
                                removedFromAny = true;
                            }
                        });
                    }

                    if (!removedFromAny) {
                        return await interaction.editReply('⚠️ You were not allocated to any roles on this flight.');
                    }

                    await allocation.save();

                    const rolesFormatted = removedRoles.length > 0 ? removedRoles.join(', ') : 'your roles';

                    await sendDM(interaction.user, `You have unallocated as **${rolesFormatted}** for **${flightNum}**.`);

                    for (const p of promotedUsers) {
                        await sendDM(p.user, `🎉 You have been automatically promoted from the waiting queue as **${p.roleLabel}** for **${flightNum}**!`);
                    }

                    if (embeds && typeof embeds.buildMainEmbed === 'function' && typeof embeds.buildButtons === 'function') {
                        await interaction.message.edit({
                            embeds: [embeds.buildMainEmbed(allocation.flight, allocation)],
                            components: embeds.buildButtons()
                        }).catch(err => console.error("Failed to edit flight embed:", err));
                    }

                    await sendLog(interaction, {
                        action: '🔴 Left All Shifts',
                        user: interaction.user,
                        role: rolesFormatted,
                        flightNumber: flightNum,
                        messageId
                    });

                    return await interaction.editReply(`✅ You have unallocated as **${rolesFormatted}** for **${flightNum}**.`);
                }

                // ------------------------------------------
                // B. TOGGLE SPECIFIC ROLE
                // ------------------------------------------
                const rawRoleKey = rawValue.replace(/^(alloc_|join_)/, ''); 
                
                let roleLabel = rawRoleKey;
                let maxSlots = 1;
                let roleKey = rawRoleKey;

                if (embeds && typeof embeds.getRoleConfig === 'function') {
                    const roleConfig = embeds.getRoleConfig(rawRoleKey);
                    if (roleConfig) {
                        roleKey = roleConfig.key;
                        roleLabel = roleConfig.label || roleKey;
                        maxSlots = roleConfig.max || 1;
                    }
                }

                const possibleKeys = KEY_ALIASES[roleKey] || [roleKey];
                
                if (!allocation[roleKey]) allocation[roleKey] = [];
                if (!Array.isArray(allocation[roleKey])) allocation[roleKey] = [];
                if (!allocation.queues) allocation.queues = {};
                if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

                let isAllocated = false;
                let matchedKey = roleKey;
                for (const k of possibleKeys) {
                    if (allocation[k]) {
                        if (Array.isArray(allocation[k]) && allocation[k].map(id => id.toString()).includes(userId)) {
                            isAllocated = true;
                            matchedKey = k;
                            break;
                        } else if (allocation[k].toString() === userId) {
                            isAllocated = true;
                            matchedKey = k;
                            break;
                        }
                    }
                }

                const isInQueue = Array.isArray(allocation.queues[roleKey]) && allocation.queues[roleKey].map(id => id.toString()).includes(userId);
                const flightNum = allocation.flight?.number || 'Unknown Flight';

                if (allocation.isLocked === true) {
                    if (isAllocated || isInQueue) {
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

                // ==========================================
                // DUAL ALLOCATION VALIDATION CHECK
                // ==========================================
                if (!isAllocated && !isInQueue) {
                    const isTargetAirportWorker = AIRPORT_WORKER_KEYS.includes(roleKey) || AIRPORT_WORKER_KEYS.includes(matchedKey);
                    const isTargetMainDept = MAIN_DEPARTMENT_KEYS.includes(roleKey) || MAIN_DEPARTMENT_KEYS.includes(matchedKey);

                    // Check if user already holds a Main Department role
                    let currentMainRole = null;
                    for (const k of MAIN_DEPARTMENT_KEYS) {
                        if (allocation[k] && Array.isArray(allocation[k]) && allocation[k].map(id => id.toString()).includes(userId)) {
                            currentMainRole = k;
                            break;
                        }
                    }

                    // Check if user already holds an Airport Worker role
                    let currentAirportRole = null;
                    for (const k of AIRPORT_WORKER_KEYS) {
                        if (allocation[k] && Array.isArray(allocation[k]) && allocation[k].map(id => id.toString()).includes(userId)) {
                            currentAirportRole = k;
                            break;
                        }
                    }

                    if (isTargetMainDept && currentMainRole) {
                        return await interaction.reply({
                            content: `❌ **Allocation Blocked:** You are already allocated to a operational department position. You can only hold **one** main department role plus **one** Airport Worker role.`,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    if (isTargetAirportWorker && currentAirportRole) {
                        return await interaction.reply({
                            content: `❌ **Allocation Blocked:** You are already allocated to an Airport Worker role. You can only hold **one** Airport Worker role.`,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                }

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});

                if (isAllocated || isInQueue) {
                    if (isAllocated) {
                        possibleKeys.forEach(k => {
                            if (Array.isArray(allocation[k])) {
                                allocation[k] = allocation[k].filter(id => id.toString() !== userId);
                                allocation.markModified(k);
                            } else if (allocation[k] && allocation[k].toString() === userId) {
                                allocation[k] = [];
                                allocation.markModified(k);
                            }
                        });

                        let promotedUser = null;
                        const queueKeyMatch = possibleKeys.find(k => Array.isArray(allocation.queues[k]) && allocation.queues[k].length > 0) || roleKey;
                        
                        if (allocation.queues[queueKeyMatch] && allocation.queues[queueKeyMatch].length > 0) {
                            const nextUserId = allocation.queues[queueKeyMatch].shift();
                            allocation.markModified('queues');
                            
                            if (Array.isArray(allocation[matchedKey])) {
                                allocation[matchedKey].push(nextUserId);
                                allocation.markModified(matchedKey);
                            } else {
                                allocation[roleKey].push(nextUserId);
                                allocation.markModified(roleKey);
                            }

                            try {
                                promotedUser = await interaction.client.users.fetch(nextUserId);
                            } catch {}
                        }

                        await allocation.save();
                        await interaction.editReply(`🔴 Removed you from **${roleLabel}**.`);
                        await sendDM(interaction.user, `You have unallocated as **${roleLabel}** for **${flightNum}**.`);

                        if (promotedUser) {
                            await sendDM(promotedUser, `🎉 You have been automatically promoted from the queue as **${roleLabel}** for **${flightNum}**!`);
                        }

                        await sendLog(interaction, {
                            action: '🔴 De-allocated',
                            user: interaction.user,
                            role: roleLabel,
                            flightNumber: flightNum,
                            messageId
                        });

                    } else if (isInQueue) {
                        allocation.queues[roleKey] = allocation.queues[roleKey].filter(id => id.toString() !== userId);
                        allocation.markModified('queues');

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
                    const currentList = Array.isArray(allocation[matchedKey]) ? allocation[matchedKey] : allocation[roleKey];

                    if (currentList.length < maxSlots) {
                        if (Array.isArray(allocation[matchedKey])) {
                            allocation[matchedKey].push(userId);
                            allocation.markModified(matchedKey);
                        } else {
                            allocation[roleKey].push(userId);
                            allocation.markModified(roleKey);
                        }

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
                            allocation.markModified('queues');

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
        // 2. MODAL SUBMISSIONS (LOA & PROFILE CREATION)
        // ==========================================
        if (interaction.isModalSubmit()) {

            // --- A. PROFILE SELF-CREATION MODAL (SENT TO HR FOR APPROVAL) ---
            if (interaction.customId === 'modal_create_profile') {
                try {
                    const username = interaction.fields.getTextInputValue('input_roblox_username').trim();
                    const robloxId = interaction.fields.getTextInputValue('input_roblox_id').trim();

                    if (isNaN(robloxId)) {
                        return await interaction.reply({
                            content: '❌ **Invalid Roblox User ID.** Please enter numbers only (e.g. `1081092271`).',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    let profile = await Profile.findOne({ userId: interaction.user.id });

                    if (profile) {
                        profile.robloxUsername = username;
                        profile.robloxId = robloxId;
                        profile.isApproved = false; // Reset to pending approval upon re-submission
                        await profile.save();
                    } else {
                        profile = new Profile({
                            userId: interaction.user.id,
                            robloxUsername: username,
                            robloxId: robloxId,
                            rank: 'Flight Crew',
                            isApproved: false
                        });
                        await profile.save();
                    }

                    // Send Embed to Human Resources Approval Channel
                    const approvalChannelId = process.env.PROFILE_APPROVAL_CHANNEL_ID;
                    const approvalChannel = await interaction.client.channels.fetch(approvalChannelId).catch(() => null);

                    if (approvalChannel) {
                        const hrEmbed = new EmbedBuilder()
                            .setColor('#0C2340')
                            .setTitle('📋 New Staff Profile Registration')
                            .setDescription(
                                `A new profile registration request has been submitted for Human Resources review.\n\n` +
                                `👤 **Discord User:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                                `🎮 **Roblox Username:** ${username}\n` +
                                `🆔 **Roblox User ID:** ${robloxId}\n` +
                                `🔗 **Roblox Profile:** [View Account](https://www.roblox.com/users/${robloxId}/profile)`
                            )
                            .setThumbnail(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=420x420&format=Png&isCircular=false`)
                            .setFooter({ text: 'LOT Polish Airlines • Human Resources' })
                            .setTimestamp();

                        const hrButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`prof_approve_${profile._id}`)
                                .setLabel('Approve')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`prof_deny_${profile._id}`)
                                .setLabel('Deny')
                                .setStyle(ButtonStyle.Danger)
                        );

                        await approvalChannel.send({ embeds: [hrEmbed], components: [hrButtons] });
                    }

                    return await interaction.reply({
                        content: `✅ **Request Submitted!** Your registration request for **${username}** has been sent to **Human Resources** for approval. You will receive a Direct Message once your profile has been reviewed.`,
                        flags: [MessageFlags.Ephemeral]
                    });

                } catch (err) {
                    console.error('Error saving profile from modal:', err);
                    return await interaction.reply({
                        content: '❌ Failed to save your profile to the database. Please contact Administration.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }
            }

            // --- B. LOA INITIAL SUBMISSION ---
            if (interaction.customId === 'loa_modal') {
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
                        .setColor('#0C2340')
                        .setTitle('New Leave of Absence Request')
                        .setDescription(`┃ User: <@${interaction.user.id}>\n┃ From: ${startStr}\n┃ To: ${endStr}\n\nReason Given\n┃ \`${reason}\``)
                        .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
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

            // --- C. LOA EDIT END DATE MODAL ---
            if (interaction.customId.startsWith('loa_editmodal_')) {
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
        }

        // ==========================================
        // 3. BUTTON HANDLERS (PROFILE, LOA & FLIGHT DECK)
        // ==========================================
        if (interaction.isButton()) {
            
            // --- A. TRIGGER PROFILE CREATION MODAL ---
            if (interaction.customId === 'btn_open_profile_modal') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_create_profile')
                    .setTitle('LOT Staff Profile Registration');

                const usernameInput = new TextInputBuilder()
                    .setCustomId('input_roblox_username')
                    .setLabel('Roblox Username')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. ArasWorld2')
                    .setRequired(true);

                const idInput = new TextInputBuilder()
                    .setCustomId('input_roblox_id')
                    .setLabel('Roblox User ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. 1081092271')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usernameInput),
                    new ActionRowBuilder().addComponents(idInput)
                );

                return await interaction.showModal(modal);
            }

            // --- B. PROFILE HR APPROVAL / DENIAL BUTTONS ---
            if (interaction.customId.startsWith('prof_approve_') || interaction.customId.startsWith('prof_deny_')) {
                const isApprove = interaction.customId.startsWith('prof_approve_');
                const profileId = interaction.customId.replace('prof_approve_', '').replace('prof_deny_', '');

                const profile = await Profile.findById(profileId);
                if (!profile) {
                    return await interaction.reply({ content: '❌ Profile record not found in database.', flags: [MessageFlags.Ephemeral] });
                }

                const targetUser = await interaction.client.users.fetch(profile.userId).catch(() => null);

                if (isApprove) {
                    profile.isApproved = true;
                    await profile.save();

                    const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#2ecc71')
                        .setTitle('✅ Staff Profile Approved')
                        .setDescription(interaction.message.embeds[0].description + `\n\n🟢 **Status:** Approved by <@${interaction.user.id}>`);

                    await interaction.message.edit({ embeds: [approvedEmbed], components: [] });

                    if (targetUser) {
                        await sendDM(targetUser, `🎉 **Profile Approved!**\nYour LOT Polish Airlines staff profile registration (**${profile.robloxUsername}**) has been approved by Human Resources. You can now use \`/profile\`!`);
                    }

                    return await interaction.reply({ content: `✅ Approved profile for <@${profile.userId}>. DM notification sent.`, flags: [MessageFlags.Ephemeral] });

                } else {
                    await Profile.findByIdAndDelete(profileId);

                    const deniedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#e74c3c')
                        .setTitle('❌ Staff Profile Denied')
                        .setDescription(interaction.message.embeds[0].description + `\n\n🔴 **Status:** Denied and removed by <@${interaction.user.id}>`);

                    await interaction.message.edit({ embeds: [deniedEmbed], components: [] });

                    if (targetUser) {
                        await sendDM(targetUser, `❌ **Profile Registration Denied**\nYour LOT Polish Airlines staff profile registration (**${profile.robloxUsername}**) was denied by Human Resources. Please double-check your Roblox details and try submitting again.`);
                    }

                    return await interaction.reply({ content: `❌ Denied and removed profile application for <@${profile.userId}>. DM notification sent.`, flags: [MessageFlags.Ephemeral] });
                }
            }

            // --- C. FLIGHT DECK LOTTERY POOL BUTTONS ---
            if (interaction.customId.startsWith('fd_apply_cpt_') || interaction.customId.startsWith('fd_apply_fo_')) {
                try {
                    const isCpt = interaction.customId.startsWith('fd_apply_cpt_');
                    const messageId = interaction.customId.replace('fd_apply_cpt_', '').replace('fd_apply_fo_', '');
                    const userId = interaction.user.id;

                    const allocation = await Allocation.findOne({ messageId });
                    if (!allocation) {
                        return await interaction.reply({ content: '❌ Flight allocation data not found.', flags: [MessageFlags.Ephemeral] });
                    }

                    if (!allocation.cptPool) allocation.cptPool = [];
                    if (!allocation.foPool)  allocation.foPool = [];

                    let replyMessage = '';

                    if (isCpt) {
                        if (allocation.cptPool.includes(userId)) {
                            allocation.cptPool = allocation.cptPool.filter(id => id !== userId);
                            replyMessage = '🔴 Removed from the **Captain** lottery pool.';
                        } else {
                            allocation.cptPool.push(userId);
                            allocation.foPool = allocation.foPool.filter(id => id !== userId);
                            replyMessage = '✅ Successfully entered the **Captain** lottery pool!';
                        }
                    } else {
                        if (allocation.foPool.includes(userId)) {
                            allocation.foPool = allocation.foPool.filter(id => id !== userId);
                            replyMessage = '🔴 Removed from the **First Officer** lottery pool.';
                        } else {
                            allocation.foPool.push(userId);
                            allocation.cptPool = allocation.cptPool.filter(id => id !== userId);
                            replyMessage = '✅ Successfully entered the **First Officer** lottery pool!';
                        }
                    }

                    allocation.markModified('cptPool');
                    allocation.markModified('foPool');
                    await allocation.save();

                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setDescription(
                            `Click below to register for **Captain** or **First Officer** for flight **${allocation.flight.number}**.\n\n` +
                            `A host will run \`/choosefd\` to randomly select assigned pilots from this pool.\n\n` +
                            `• **Captain Candidates:** ${allocation.cptPool.length}\n` +
                            `• **First Officer Candidates:** ${allocation.foPool.length}`
                        );

                    await interaction.message.edit({ embeds: [updatedEmbed] });
                    return await interaction.reply({ content: replyMessage, flags: [MessageFlags.Ephemeral] });

                } catch (err) {
                    console.error('❌ Flight deck lottery button error:', err);
                    return await interaction.reply({ content: '❌ Failed to process pool entry.', flags: [MessageFlags.Ephemeral] });
                }
            }

            // --- D. LOA MANAGEMENT ACTION BUTTONS ---
            if (interaction.customId.startsWith('loa_')) {
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
                        .setColor('#0C2340') 
                        .setTitle('Leave Approved')
                        .setDescription(`┃ This leave request has been approved by <@${interaction.user.id}>.\n\nMember\n┃ <@${loaRecord.userId}>\n\nApproved Dates\n┃ ${formatDateStr(loaRecord.startDate)} to ${formatDateStr(loaRecord.endDate)}\n\nReason Given\n┃ \`${loaRecord.reason}\``)
                        .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
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
                        .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
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
        }

        // ==========================================
        // 4. CHAT COMMAND DISPATCHER
        // ==========================================
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing /${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] }).catch(() => {});
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] }).catch(() => {});
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
