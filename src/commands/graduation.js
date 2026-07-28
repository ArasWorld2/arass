const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('graduation')
    .setDescription('Send an Apprenticeship Onboarding embed notification to multiple members via Direct Message')
    .addStringOption(option => 
      option
        .setName('user_ids')
        .setDescription('Discord User IDs separated by space or comma (e.g. 12345 67890)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawInput = interaction.options.getString('user_ids');
    
    // Split input by commas or spaces and extract unique non-empty IDs
    const userIds = [...new Set(rawInput.split(/[\s,]+/).filter(id => id.length > 0))];

    if (userIds.length === 0) {
      return interaction.editReply('❌ Please provide at least one valid User ID.');
    }

    // Build Discord Embed with color #D3007F
    const embed = new EmbedBuilder()
      .setColor('#D3007F')
      .setTitle('<:group:1414277778794221649> Apprenticeship Onboarding')
      .setDescription(
        `-# <:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>\n\n` +
        `> **Wizz Air** is pleased to officially welcome you to the Wizz Air Personnel server. Our Training Managers extend our sincerest gratitude for your dedication, commitment, and proactiveness throughout our training programme. Following a successful completion of your examination, we are honoured to extend an invite to you to join on an internship basis within our team.\n\n` +
        `<:arrow:1414277373909794937> In regards to **completion of your apprenticeship**, you must attend two flights (if you are a Captain or a Ground Crew member), and three flights (if you are a First Officer or Cabin Crew). Members of Flight Deck with both the Captain and First Officer license complete approximately five flights in total.\n\n` +
        `> <:link:1414278009573347328> [**Personnel Server Invitation**](<https://discord.gg/buUkN5xztp>)\n` +
        `-# Once you join, please await verification by a member of the Management Board. You will be provided further information after you are successfully verified.`
      );

    const successful = [];
    const failed = [];

    // Loop through all provided user IDs
    for (const userId of userIds) {
      try {
        const targetUser = await interaction.client.users.fetch(userId);
        await targetUser.send({ embeds: [embed] });
        successful.push(`<@${userId}>`);
      } catch (err) {
        console.warn(`Could not send Graduation DM to user ID ${userId}:`, err.message);
        failed.push(`\`${userId}\``);
      }
    }

    // Build summary response
    let responseText = `**Graduation Onboarding Dispatcher Summary**\n\n`;

    if (successful.length > 0) {
      responseText += `✅ **DMs Sent Successfully (${successful.length}):**\n${successful.join(', ')}\n\n`;
    }

    if (failed.length > 0) {
      responseText += `⚠️ **Failed to DM / Invalid ID (${failed.length}):**\n${failed.join(', ')}`;
    }

    return interaction.editReply(responseText);
  },
};