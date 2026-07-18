const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unallocate')
    .setDescription('Admin: Remove a user from a role on a flight')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the flight allocation').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true))
    .addStringOption(o => {
      const opt = o.setName('role').setDescription('Role to remove them from').setRequired(true);
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
    if (!allocation) return interaction.editReply('❌ Allocation not found.');

    // 🔒 LOCK INTERCEPT ENGINE OVERRIDE
    if (allocation.isLocked) {
      return interaction.editReply('🔒 **Allocation Error:** This timetable schedule is currently locked. No modifications or unallocations are permitted.');
    }

    const filled = allocation[roleKey] || [];
    const queue  = allocation.queues?.[roleKey] || [];

    if (filled.includes(user.id)) {
      allocation[roleKey] = filled.filter(id => id !== user.id);

      // Remove linked role too
      if (roleConfig.linkedRole) {
        allocation[roleConfig.linkedRole] = (allocation[roleConfig.linkedRole] || []).filter(id => id !== user.id);
      }

      // Promote from queue
      if (queue.length > 0) {
        const promoted = queue.shift();
        allocation[roleKey].push(promoted);
        allocation.queues[roleKey] = queue;
        if (roleConfig.linkedRole) allocation[roleConfig.linkedRole] = [promoted];
      }

      await allocation.save();

      // Refresh message
      try {
        const channel = await interaction.client.channels.fetch(allocation.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.edit({ embeds: [buildMainEmbed(allocation.flight, allocation)], components: buildButtons() });
      } catch {}

      // Send log
      await sendLog(interaction, {
        action: '🔴 Unallocated',
        admin: interaction.user,
        target: user,
        role: roleConfig.label,
        flightNumber: allocation.flight.number,
        messageId,
      });

      return interaction.editReply(`✅ Removed <@${user.id}> from **${roleConfig.label}**.`);
    }

    if (queue.includes(user.id)) {
      allocation.queues[roleKey] = queue.filter(id => id !== user.id);
      await allocation.save();

      await sendLog(interaction, {
        action: '🔴 Removed from queue',
        admin: interaction.user,
        target: user,
        role: roleConfig.label,
        flightNumber: allocation.flight.number,
        messageId,
      });

      return interaction.editReply(`✅ Removed <@${user.id}> from the **${roleConfig.label}** queue.`);
    }

    return interaction.editReply(`❌ <@${user.id}> is not in **${roleConfig.label}**.`);
  },
};

async function sendLog(interaction, { action, admin, target, role, flightNumber, messageId }) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;
  try {
    const channel = await interaction.client.channels.fetch(logChannelId);
    await channel.send(`${action} | **Flight ${flightNumber}** | **${role}** | User: <@${target.id}> | By: <@${admin.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId})`);
  } catch (err) {
    console.warn('Could not send log:', err.message);
  }
}