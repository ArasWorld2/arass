const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('examresults')
        .setDescription('DM examination results as an embed directly to a student using their Discord ID')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Restrict to Staff/Admins
        .addStringOption(option =>
            option.setName('studentid')
                .setDescription('The Discord User ID of the candidate')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('score')
                .setDescription('The points scored by the student')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('outof')
                .setDescription('The total possible points (what it is out of)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('examtype')
                .setDescription('Name of the exam (e.g. Ground Staff, Cabin Crew)')
                .setRequired(false)),

    async execute(interaction) {
        const studentIdRaw = interaction.options.getString('studentid');
        const score = interaction.options.getInteger('score');
        const outOf = interaction.options.getInteger('outof');
        const examType = interaction.options.getString('examtype') || 'Recruitment Assessment';

        // Clean user ID input
        const studentId = studentIdRaw.replace(/[^0-9]/g, '');

        if (!studentId) {
            return interaction.reply({ content: '❌ Invalid Discord User ID provided.', ephemeral: true });
        }

        if (outOf <= 0) {
            return interaction.reply({ content: '❌ The "outof" value must be greater than 0.', ephemeral: true });
        }

        // Fetch User by ID
        let student;
        try {
            student = await interaction.client.users.fetch(studentId);
        } catch (fetchErr) {
            return interaction.reply({ 
                content: `❌ Could not find any Discord user with the ID \`${studentId}\`. Please check the ID and try again!`, 
                ephemeral: true 
            });
        }

        // Percentage & Pass/Fail Calculations
        const percentage = Math.round((score / outOf) * 100);
        const passed = percentage >= 80;

        // Dynamic Text Paragraphs based on Pass/Fail
        let mainMessage = "";
        let finalMessage = "";

        if (passed) {
            mainMessage = "Congratulations, on behalf of the **Wizz Recruitment Department**, we are pleased to announce that you have successfully passed your examination. Your performance has met the required standard, and we are delighted to confirm your successful result.";
            finalMessage = "Your examination has now been officially recorded, and you may now proceed with your progression within the **Wizz Academy**. We appreciate the effort and dedication you demonstrated throughout the assessment process, and we look forward to seeing your continued success. Once again, **congratulations** on your achievement!";
        } else {
            mainMessage = "On behalf of the **Wizz Recruitment Department**, we regret to inform you that you have not met the required pass mark for your examination.";
            finalMessage = `Your examination result of **${percentage}%** is below the required **80%** pass mark. We encourage you to review the study materials and re-apply for your assessment in the future. We thank you for your time and effort throughout the assessment process!`;
        }

        // Build Discord Embed with #D3007F color
        const examEmbed = new EmbedBuilder()
            .setColor('#D3007F')
            .setTitle(`<:care:1414277804555632801> Examination Results (${examType})`)
            .setDescription(`<:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>\n\n> ${mainMessage}`)
            .addFields(
                {
                    name: '<:arrow:1414277373909794937> Results',
                    value: `> • **Score:** \`${score}/${outOf}\`\n> • **Points:** \`${score}\`\n> • **Percentage:** \`${percentage}%\``,
                    inline: false
                },
                {
                    name: '<:arrow:1414277373909794937> Status & Progression',
                    value: `> ${finalMessage}`,
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Onboarding Office, Recruitment Department • Wizz Air, Fly Greenest'
            })
            .setTimestamp();

        try {
            // Send Embed in Direct Message
            await student.send({ embeds: [examEmbed] });

            return interaction.reply({ 
                content: `✅ Successfully sent embedded examination results to **${student.tag}** (\`${student.id}\`)! (${percentage}% - ${passed ? 'PASSED' : 'FAILED'})`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error(`Failed to DM ${student.tag}:`, error);
            return interaction.reply({ 
                content: `❌ Could not send DM to **${student.tag}** (\`${student.id}\`). They likely have DMs disabled!`, 
                ephemeral: true 
            });
        }
    }
};