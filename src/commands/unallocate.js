const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
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
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('message_id');
    const user      = interaction.options.getUser('user');
    const roleKey   = interaction.options.getString('role');
    const roleConfig = getRoleConfig(roleKey);

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) return interaction.editReply('❌ Allocation not found.');

    // Ensure database properties are safely array-initialized
    if (!allocation[roleKey]) allocation[roleKey] = [];
    if (!allocation.queues) allocation.queues = {};
    if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

    const filled = allocation[roleKey];
    const queue  = allocation.queues[roleKey];

    // 1. Remove user from active slot
    if (filled.includes(user.id)) {
      allocation[roleKey] = filled.filter(id => id !== user.id);

      // Handle linked roles if specified in config
      if (roleConfig.linkedRole && allocation[roleConfig.linkedRole]) {
        allocation[roleConfig.linkedRole] = allocation[roleConfig.linkedRole].filter(id => id !== user.id);
      }

      // Promote next candidate from waiting queue
      let promotedUser = null;
      if (queue.length > 0) {
        const promotedId = queue.shift();
        allocation[roleKey].push(promotedId);
        allocation.queues[roleKey] = queue;

        if (roleConfig.linkedRole) allocation[roleConfig.linkedRole] = [promotedId];

        try {
          promotedUser = await interaction.client.users.fetch(promotedId);
        } catch {}
      }

      await allocation.save();

      // Refresh main flight sheet embed message
      try {
        const channel = await interaction.client.channels.fetch(allocation.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.edit({ 
          embeds: [buildMainEmbed(allocation.flight, allocation)], 
          components: buildButtons() 
        });
      } catch (err) {
        console.warn('Could not refresh allocation embed message:', err.message);
      }

      // DM promoted user if applicable
      if (promotedUser) {
        try {
          await promotedUser.send(
            `✈️ **LOT Polish Airlines Notice**\n\n` +
            `You have been promoted from the queue to **${roleConfig.label}** for flight **${allocation.flight?.number || 'Flight'}**.`
          );
        } catch {}
      }

      // Send operational log
      await sendLog(interaction, {
        action: '🔴 Admin Unallocated',
        admin: interaction.user,
        target: user,
        role: roleConfig.label,
        flightNumber: allocation.flight?.number || 'Unknown',
        messageId,
      });

      return interaction.editReply(`✅ Removed <@${user.id}> from **${roleConfig.label}**.`);
    }

    // 2. Remove user from queue
    if (queue.includes(user.id)) {
      allocation.queues[roleKey] = queue.filter(id => id !== user.id);
      await allocation.save();

      await sendLog(interaction, {
        action: '🔴 Admin Removed from Queue',
        admin: interaction.user,
        target: user,
        role: roleConfig.label,
        flightNumber: allocation.flight?.number || 'Unknown',
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
    console.warn('Could not send unallocate log:', err.message);
  }
}
