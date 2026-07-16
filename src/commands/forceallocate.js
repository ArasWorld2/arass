const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forceallocate')
    .setDescription('Admin: Forcefully allocate a user to a role on a flight')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the flight allocation').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User to allocate').setRequired(true))
    .addStringOption(o => {
      const opt = o.setName('role').setDescription('Role to assign them to').setRequired(true);
      // Dynamically load your non-autofilled roles as choices
      ROLES.filter(r => !r.autoFilled).forEach(r => opt.addChoices({ name: r.label, value: r.key }));
      return opt;
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');
    const user      = interaction.options.getUser('user');
    const roleKey   = interaction.options.getString('role');
    const roleConfig = getRoleConfig(roleKey);

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) return interaction.editReply('❌ Allocation sheet not found.');

    if (!allocation[roleKey]) allocation[roleKey] = [];

    // Check if they are already in this role
    if (allocation[roleKey].includes(user.id)) {
      return interaction.editReply(`⚠️ <@${user.id}> is already allocated to **${roleConfig.label}**.`);
    }

    // Force add them to the role array (ignores maximum slot limits and double-booking checks)
    allocation[roleKey].push(user.id);

    // If they were in the queue for this role, remove them from it
    if (allocation.queues?.[roleKey]) {
      allocation.queues[roleKey] = allocation.queues[roleKey].filter(id => id !== user.id);
    }

    await allocation.save();

    // Refresh the flight sheet message
    try {
      const channel = await interaction.client.channels.fetch(allocation.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.edit({ 
        embeds: [buildMainEmbed(allocation.flight, allocation)], 
        components: buildButtons() 
      });
    } catch (err) {
      console.warn('Could not refresh embed message:', err.message);
    }

    // Send the log to your logging channel
    await sendLog(interaction, {
      action: '🟢 Force Allocated',
      admin: interaction.user,
      target: user,
      role: roleConfig.label,
      flightNumber: allocation.flight?.number || 'Unknown',
      messageId,
    });

    return interaction.editReply(`✅ Forcefully allocated <@${user.id}> as **${roleConfig.label}**!`);
  },
};

async function sendLog(interaction, { action, admin, target, role, flightNumber, messageId }) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;
  try {
    const channel = await interaction.client.channels.fetch(logChannelId);
    await channel.send(`${action} | **Flight ${flightNumber}** | **${role}** | User: <@${target.id}> | By: <@${admin.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId})`);
  } catch (err) {
    console.warn('Could not send force allocate log:', err.message);
  }
}