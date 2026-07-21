const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('academyinvite')
        .setDescription('DM an official Wizz Academy invite link directly to a student')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('studentid')
                .setDescription('The Discord User ID of the student')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('invitelink')
                .setDescription('The Wizz Academy Discord server invite link')
                .setRequired(true)),

    async execute(interaction) {
        // Defer reply to allow time for API calls
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const studentIdRaw = interaction.options.getString('studentid');
        const inviteLink = interaction.options.getString('invitelink');

        // Clean Discord User ID input
        const studentId = studentIdRaw.replace(/[^0-9]/g, '');

        if (!studentId) {
            return interaction.editReply({ content: '❌ Invalid Discord User ID provided.' });
        }

        // Fetch user from Discord API
        let student;
        try {
            student = await interaction.client.users.fetch(studentId);
        } catch (fetchErr) {
            return interaction.editReply({ 
                content: `❌ Could not find any Discord user with ID \`${studentId}\`. Please verify the ID.` 
            });
        }

        // Build the Wizz Academy Invite Embed
        const inviteEmbed = new EmbedBuilder()
            .setColor('#D3007F')
            .setTitle('<:care:1414277804555632801> Wizz Academy Invitation')
            .setDescription(
                `<:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>\n\n` +
                `> Congratulations! On behalf of the **Wizz Recruitment Department**, you are officially invited to join the **Wizz Academy** to continue your training and progression.`
            )
            .addFields(
                {
                    name: '<:arrow:1414277373909794937> Access Link',
                    value: `• **Academy Portal:** [Click Here to Join the Wizz Academy](${inviteLink})\n• **Direct Link:** \`${inviteLink}\``,
                    inline: false
                },
                {
                    name: '<:arrow:1414277373909794937> Next Steps',
                    value: `> Upon joining, please review the welcome guidelines and ensure your server nickname matches your official full name/callsign. We wish you the best of luck in your training!`,
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Onboarding Office, Recruitment Department • Wizz Air, Fly Greenest' 
            })
            .setTimestamp();

        try {
            // DM the student
            await student.send({ embeds: [inviteEmbed] });

            return interaction.editReply({ 
                content: `✅ Successfully sent Wizz Academy invitation to **${student.tag}** (\`${student.id}\`)!` 
            });
        } catch (error) {
            console.error(`Failed to DM academy invite to ${student.tag}:`, error);
            return interaction.editReply({ 
                content: `❌ Could not send DM to **${student.tag}**. DMs might be disabled or blocked!` 
            });
        }
    }
};