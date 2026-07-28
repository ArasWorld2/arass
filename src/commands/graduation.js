const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('graduation')
    .setDescription('Send an Apprenticeship Onboarding notification to a member via Direct Message')
    .addStringOption(option => 
      option
        .setName('user_id')
        .setDescription('The Discord User ID of the graduating member')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.options.getString('user_id').trim();

    // Fetch user profile from Discord
    let targetUser;
    try {
      targetUser = await interaction.client.users.fetch(userId);
    } catch {
      return interaction.editReply(`❌ Invalid User ID provided: \`${userId}\`. Could not find this user.`);
    }

    // Direct Message Content matching your exact format
    const graduationMessage = 
      `### <:group:1414277778794221649> Apprenticeship Onboarding\n` +
      `-# <:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>\n\n` +
      `> **Wizz Air** is pleased to officially welcome you to the Wizz Air Personnel server. Our Training Managers extend our sincerest gratitude for your dedication, commitment, and proactiveness throughout our training programme. Following a successful completion of your examination, we are honoured to extend an invite to you to join on an internship basis within our team.\n\n` +
      `<:arrow:1414277373909794937> In regards to **completion of your apprenticeship**, you must attend two flights (if you are a Captain or a Ground Crew member), and three flights (if you are a First Officer or Cabin Crew). Members of Flight Deck with both the Captain and First Officer license complete approximately five flights in total.\n\n` +
      `> <:link:1414278009573347328> [**Personnel Server Invitation**](<https://discord.gg/buUkN5xztp>)\n` +
      `-# Once you join, please await verification by a member of the Management Board. You will be provided further information after you are successfully verified.`;

    let dmSent = false;
    try {
      await targetUser.send(graduationMessage);
      dmSent = true;
    } catch {
      console.warn(`Could not send Graduation DM to user ${userId} (DMs might be disabled).`);
    }

    if (dmSent) {
      return interaction.editReply(`✅ Successfully sent graduation DM to <@${targetUser.id}> (\`${targetUser.id}\`)!`);
    } else {
      return interaction.editReply(`⚠️ Graduation command completed, but could not DM <@${targetUser.id}> (DMs are disabled for this user).`);
    }
  },
};