const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('academyinvite')
        .setDescription('Admin: Send an embed invite to join the academy to multiple users')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('user_ids')
                .setDescription('Paste user IDs separated by spaces or commas (e.g., 123456 789012)')
                .setRequired(true)),

    async execute(interaction) {
        // Optional permission check helper
        if (typeof checkRole === 'function' && !checkRole(interaction)) return;

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const rawUserIds = interaction.options.getString('user_ids');
        
        // Split IDs by commas, spaces, or newlines and clean non-numeric chars
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

        // 3. Build the Wizz Air Embed Layout
        const inviteEmbed = new EmbedBuilder()
            .setColor('#D3007F')
            .setTitle('<:care:1414277804555632801> Application Status')
            .setDescription(
                `<:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>\n\n` +
                `> Congratulations, on behalf of the **Wizz Recruitment Department**, we are pleased to announce that you have passed our direct entry opportunity and you're officially cleared to start building your career with us here at Wizz.\n\n` +
                `<:arrow:1414277373909794937> To begin your career, we have an extensive two weeks prepared ahead for you whilst presenting one of the most challenging yet realistic training programs, designed individually depending on each department and different strengths. Once again, **congratulations**!\n\n` +
                `<:click:1414277937187782818> **[Academy Invitation](https://discord.gg/GZPHEGTBEA)**\n` +
                `-# This link is strictly protected under our internal regulations, and leaking to third-parties will result in a **blacklist** from our organisation. Ensure that you follow the instructions provided to verify and continue your journey within the academy.`
            )
            .setFooter({
                text: 'Onboarding Office, Recruitment Department • Wizz Air, Fly Greenest',
                iconURL: interaction.guild?.iconURL() || undefined
            });

        const signOffText = "<:heart:1414277635126591579> **Viszlát**";

        // 4. Loop through each user ID and attempt to DM them the embed
        for (const id of userIds) {
            try {
                const user = await interaction.client.users.fetch(id);
                
                // Embeds sent via DM work best when accompanied by a clean sign-off text outside the block
                await user.send({ content: signOffText, embeds: [inviteEmbed] });
                successCount++;
            } catch (err) {
                console.error(`Failed to send embed invite to ID ${id}:`, err.message);
                failedUsers.push(id);
            }
        }

        // 5. Respond with a summary report
        let responseMessage = `✅ Successfully sent academy embed invites to **${successCount}** user(s).`;
        if (failedUsers.length > 0) {
            responseMessage += `\n❌ Failed to send to the following IDs (DMs closed or invalid ID):\n\`${failedUsers.join(', ')}\``;
        }

        return interaction.editReply({ content: responseMessage });
    }
};