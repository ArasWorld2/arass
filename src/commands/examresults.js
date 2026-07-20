const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('examresults')
        .setDescription('Post examination results for a student')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // Restrict to Staff/Admins
        .addUserOption(option =>
            option.setName('student')
                .setDescription('The candidate who took the exam')
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
        const student = interaction.options.getUser('student');
        const score = interaction.options.getInteger('score');
        const outOf = interaction.options.getInteger('outof');
        const examType = interaction.options.getString('examtype') || 'Recruitment Assessment';

        if (outOf <= 0) {
            return interaction.reply({ content: '❌ The "outof" value must be greater than 0.', flags: 64 });
        }

        // Percentage & Pass/Fail Calculations
        const percentage = Math.round((score / outOf) * 100);
        const passed = percentage >= 80;

        // Dynamic Message Blocks
        let resultMessageBlock = "";
        if (passed) {
            resultMessageBlock = 
`> Congratulations, on behalf of the **Wizz Recruitment Department**, we are pleased to announce that you have successfully passed your examination. Your performance has met the required standard, and we are delighted to confirm your successful result.

<:arrow:1414277373909794937> **Results**
> • **Score:** \`${score}/${outOf}\`
> • **Points:** \`${score}\`
> • **Percentage:** \`${percentage}%\`

<:arrow:1414277373909794937> Your examination has now been officially recorded, and you may now proceed with your progression within the **Wizz Academy**. We appreciate the effort and dedication you demonstrated throughout the assessment process, and we look forward to seeing your continued success. Once again, **congratulations** on your achievement!`;
        } else {
            resultMessageBlock = 
`> On behalf of the **Wizz Recruitment Department**, we regret to inform you that you have not met the required pass mark for your examination.

<:arrow:1414277373909794937> **Results**
> • **Score:** \`${score}/${outOf}\`
> • **Points:** \`${score}\`
> • **Percentage:** \`${percentage}%\`

<:arrow:1414277373909794937> Your examination result of **${percentage}%** is below the required **80%** pass mark. We encourage you to review the study materials and re-apply for your assessment in the future. We thank you for your time and effort throughout the assessment process!`;
        }

        const announcementText = 
`<@${student.id}>

### <:care:1414277804555632801> **Examination Results** (\`${examType}\`)
<:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>

${resultMessageBlock}

<:heart:1414277635126591579> **Viszlát**
> -# **Onboarding Office**, Recruitment Department <:group:1414277778794221649>
> -# Wizz Air, **Fly Greenest** <:flygreen:1272674839441965056>`;

        // Send public announcement in channel
        await interaction.reply({ content: announcementText });
    }
};