const { SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Change the bot presence/activity status')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Restrict to admins
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('The text for the bot status')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Activity type (default: Playing)')
        .setRequired(false)
        .addChoices(
          { name: 'Playing', value: 'Playing' },
          { name: 'Watching', value: 'Watching' },
          { name: 'Listening', value: 'Listening' },
          { name: 'Competing', value: 'Competing' }
        )
    ),

  async execute(interaction) {
    const statusText = interaction.options.getString('text');
    const activityTypeInput = interaction.options.getString('type') || 'Playing';

    const activityTypeMap = {
      Playing: ActivityType.Playing,
      Watching: ActivityType.Watching,
      Listening: ActivityType.Listening,
      Competing: ActivityType.Competing,
    };

    try {
      interaction.client.user.setActivity(statusText, {
        type: activityTypeMap[activityTypeInput],
      });

      await interaction.reply({
        content: `✅ Bot status updated to: **${activityTypeInput} ${statusText}**`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      await interaction.reply({
        content: '❌ Failed to update bot status.',
        ephemeral: true,
      });
    }
  },
};
