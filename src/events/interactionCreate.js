// Add these imports at the top of interactionCreate.js if they aren't there
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const Loa = require('../models/Loa');

// Inside your execute(interaction) block:
// ==========================================
// A. HANDLE MODAL SUBMISSIONS
// ==========================================
if (interaction.isModalSubmit() && interaction.customId === 'loa_modal') {
    try {
        const startStr = interaction.fields.getTextInputValue('loa_start');
        const endStr = interaction.fields.getTextInputValue('loa_end');
        const reason = interaction.fields.getTextInputValue('loa_reason');

        // Helper helper to convert DD/MM/YYYY string safely into a JS Date object
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

        const requestLogChannelId = process.env.LOA_LOG_CHANNEL_ID; // Channel where requests go to get reviewed
        const reviewChannel = await interaction.client.channels.fetch(requestLogChannelId).catch(() => null);
        
        if (!reviewChannel) {
            return await interaction.reply({ content: '❌ LOA system channel configuration error. Please inform administration.', flags: [MessageFlags.Ephemeral] });
        }

        // Create database record
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
        
        // Save the review message ID to database so we can update it later
        loaRecord.reviewMessageId = reviewMessage.id;
        await loaRecord.save();

        return await interaction.reply({ content: '✅ Your LOA request has been successfully forwarded to management for review.', flags: [MessageFlags.Ephemeral] });

    } catch (err) {
        console.error(err);
        return await interaction.reply({ content: '❌ Something went wrong saving your request.', flags: [MessageFlags.Ephemeral] });
    }
}

// ==========================================
// B. HANDLE APPROVAL/DENIAL BUTTON PRESSES
// ==========================================
if (interaction.isButton() && interaction.customId.startsWith('loa_')) {
    // Basic permissions verification check (e.g., Manage Messages)
    if (!interaction.member.permissions.has('ManageMessages')) {
        return await interaction.reply({ content: '🚫 You lack permission to manage LOA records.', flags: [MessageFlags.Ephemeral] });
    }

    const [,, action, recordId] = interaction.customId.split('_'); 
    const loaRecord = await Loa.findById(recordId);

    if (!loaRecord || loaRecord.status !== 'PENDING') {
        return await interaction.reply({ content: '❌ This LOA request has already been processed or does not exist.', flags: [MessageFlags.Ephemeral] });
    }

    const targetUser = await interaction.client.users.fetch(loaRecord.userId).catch(() => null);

    if (interaction.customId.startsWith('loa_approve_')) {
        loaRecord.status = 'APPROVED';
        await loaRecord.save();

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#2ecc71')
            .setTitle('✅ LOA Approved')
            .setFooter({ text: `Approved by ${interaction.user.tag}` });

        await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
        if (targetUser) await targetUser.send(`🟢 **Your Leave of Absence Request has been APPROVED.** Your special role configuration will apply automatically on your scheduled start date.`).catch(() => {});
        return await interaction.reply({ content: '✅ LOA set to approved status.', flags: [MessageFlags.Ephemeral] });
    }

    if (interaction.customId.startsWith('loa_deny_')) {
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