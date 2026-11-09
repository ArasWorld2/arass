const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { checkRole } = require('../utils/checkRole');

// Custom LOT Emojis
const EMOJIS = {
    TAIL: '<:LOTTail:1520114549490057226>',
    ARROW: '<:LOTSArrow:1520114515318935584>',
    CLICK: '<:leftclick:1520114571124150373>',
    ROBLOX: '<:Roblox_White:1520114564010868998>',
    HEART: '<:LOTSHeart:1520114525586849985>'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('academyinvite')
        .setDescription('Admin: Send an embed invite to join the academy to multiple users')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('user_ids')
                .setDescription('Paste user IDs separated by spaces or commas (e.g., 123456 789012)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('batch_id')
                .setDescription('Optional custom Batch ID (default: PLLFA-26-03-1-DIRECT)')
                .setRequired(false)),

    async execute(interaction) {
        if (typeof checkRole === 'function' && !await checkRole(interaction)) return;

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const rawUserIds = interaction.options.getString('user_ids');
        const customBatchId = interaction.options.getString('batch_id') || 'PLLFA-26-03-1-DIRECT';
        
        const userIds = Array.from(
            new Set(
                rawUserIds
                    .split(/[\s,]+/)
                    .map(id => id.replace(/[^0-9]/g, ''))
                    .filter(id => id.length > 0)
            )
        );

        if (userIds.length === 0) {
            return interaction.editReply({ content: '❌ No valid user IDs provided.' });
        }

        let successCount = 0;
        let failedUsers = [];

        const embedTitle = `${EMOJIS.TAIL}  **LOT Polish Airlines**\nInvitation to the Flight Academy`;

        const description = 
            `${EMOJIS.ARROW}  Congratulations once again on successfully passing your application process! We are thrilled to welcome you to our academic training course.\n` +
            `> As you embark on this journey, we kindly ask you to join our **LOT Flight Academy communications server** and our __Roblox Group.__\n\n` +
            `${EMOJIS.CLICK}  https://discord.gg/7gwjjenNgB\n` +
            `${EMOJIS.ROBLOX} https://www.roblox.com/communities/15347085/LOT-Polish-Airlines-Group#!/about\n` +
            `${EMOJIS.HEART} Batch ID: \`\`\`${customBatchId}\`\`\`\n\n` +
            `${EMOJIS.ARROW} The academy will not only facilitate **seamless communication** but also provide you with valuable resources and opportunities for engagement within our academic community. We look forward to seeing you thrive and excel in your academic pursuits, for a workforce position.\n\n` +
            `__Dziękujemy bardzo & wishing you the best of luck,__\n` +
            `**Human Resources Department**`;

        // Build LOT Polish Airlines Embed
        const inviteEmbed = new EmbedBuilder()
            .setColor('#0C2340') // LOT Navy Blue
            .setTitle(embedTitle)
            .setDescription(description)
            .setFooter({
                text: 'LOT Polish Airlines • Flight Academy',
                iconURL: interaction.guild?.iconURL() || undefined
            })
            .setTimestamp();

        // Loop through each user ID and DM them the embed sheet
        for (const id of userIds) {
            try {
                const user = await interaction.client.users.fetch(id);
                await user.send({ embeds: [inviteEmbed] });
                successCount++;
            } catch (err) {
                console.error(`Failed to send academy invite embed to ID ${id}:`, err.message);
                failedUsers.push(id);
            }
        }

        // Summary report
        let responseMessage = `✅ Successfully sent LOT Flight Academy embed invites to **${successCount}** candidate(s).`;
        if (failedUsers.length > 0) {
            responseMessage += `\n❌ Failed to send to the following IDs (DMs closed or invalid ID):\n\`${failedUsers.join(', ')}\``;
        }

        return interaction.editReply({ content: responseMessage });
    }
};
