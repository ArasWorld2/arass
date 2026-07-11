const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('academyinvite')
        .setDescription('Admin: Send an invite to join the academy to multiple users')
        .addStringOption(option => 
            option.setName('user_ids')
                .setDescription('Paste user IDs separated by spaces or commas (e.g., 123456 789012)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // 1. Check permissions using your existing utility
        if (!await checkRole(interaction)) return;

        // 2. Defer reply since sending multiple DMs can take a moment
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const rawIds = interaction.options.getString('user_ids');
        
        // Split IDs by spaces, commas, or newlines, and filter out empty items
        const userIds = rawIds.split(/[\s,]+/).filter(id => id.trim().length > 0);

        if (userIds.length === 0) {
            return await interaction.editReply('❌ You did not provide any valid user IDs.');
        }

        let successCount = 0;
        let failedUsers = [];

        // 3. Define the plain text message content
        const inviteMessage = 
            `✈️ **Air Dolomiti — Academy Invitation**\n\n` +
            `Hello!\n\n` +
            `You have been officially invited to join the **Air Dolomiti Academy**.\n` +
            `Please follow the instructions provided by the staff or coordinate directly with them to proceed with your training.`;

        // 4. Loop through each user ID and attempt to DM them the text
        for (const id of userIds) {
            try {
                const user = await interaction.client.users.fetch(id);
                await user.send({ content: inviteMessage });
                successCount++;
            } catch (err) {
                console.error(`Failed to send invite to ID ${id}:`, err.message);
                failedUsers.push(id);
            }
        }

        // 5. Respond with a summary report
        let responseMessage = `✅ Successfully sent academy invites to **${successCount}** user(s).`;
        if (failedUsers.length > 0) {
            responseMessage += `\n❌ Failed to send to the following IDs (DMs closed or invalid ID):\n\`${failedUsers.join(', ')}\``;
        }

        await interaction.editReply(responseMessage);
    },
};