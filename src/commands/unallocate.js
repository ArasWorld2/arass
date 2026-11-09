const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unallocate')
    .setDescription('Admin: Remove a user from a role on a flight')
    .addStringOption(o => 
      o.setName('flight_number')
        .setDescription('Select or search for an active flight from MongoDB')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addUserOption(o => 
      o.setName('user')
        .setDescription('User to remove')
        .setRequired(true)
    )
    .addStringOption(o => {
      const opt = o.setName('role').setDescription('Role to remove them from').setRequired(true);
      ROLES.filter(r => !r.autoFilled).forEach(r => opt.addChoices({ name: r.label, value: r.key }));
      return opt;
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // 1. AUTOCOMPLETE: Fetches active flights directly from MongoDB
  async autocomplete(interaction) {
    try {
      const focusedValue = (interaction.options.getFocused() || '').trim().toUpperCase();

      const query = focusedValue 
        ? { 'flight.number': { $regex: focusedValue, $options: 'i' } } 
        : {};

      // Search MongoDB for active flight allocations
      const allocations = await Allocation.find(query).sort({ createdAt: -1 }).limit(10).lean();

      if (!allocations || allocations.length === 0) {
        return await interaction.respond([]).catch(() => {});
      }

      const choices = allocations.map(a => {
        const flightNum = a.flight?.number || 'UNKNOWN';
        const from = a.flight?.from || '???';
        const to = a.flight?.to || '???';
        const date = a.flight?.date || 'Today';

        return {
          name: `${flightNum} (${from} ➔ ${to} | ${date})`,
          value: a.messageId // Pass messageId as the underlying value
        };
      });

      await interaction.respond(choices).catch(() => {});
    } catch (err) {
      console.error('Autocomplete error in unallocate:', err);
      await interaction.respond([]).catch(() => {});
    }
  },

  // 2. EXECUTE: Operates directly on the MongoDB allocation record
  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('flight_number');
    const user      = interaction.options.getUser('user');
    const rawRole   = interaction.options.getString('role');

    // Key normalization: Ensures "alloc_dc" or "dc" cleanly maps to getRoleConfig("dc")
    const roleConfig = getRoleConfig(rawRole.replace(/^(alloc_|join_)/, ''));
    const roleKey    = roleConfig.key;

    // Fetch record from MongoDB
    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Allocation sheet not found in database.');
    }

    if (allocation.isLocked) {
      return interaction.editReply('🔒 **Allocation Error:** This timetable schedule is currently locked. No modifications or unallocations are permitted.');
    }

    // Ensure properties exist as arrays
    if (!allocation[roleKey]) allocation[roleKey] = [];
    if (!allocation.queues) allocation.queues = {};
    if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

    const filled = allocation[roleKey];
    const queue  = allocation.queues[roleKey];

    // Check 1: Remove from Active Role Slot
    if (filled.includes(user.id)) {
      allocation[roleKey] = filled.filter(id => id !== user.id);

      // Handle linked roles if configured
      if (roleConfig.linkedRole && allocation[roleConfig.linkedRole]) {
        allocation[roleConfig.linkedRole] = allocation[roleConfig.linkedRole].filter(id => id !== user.id);
      }

      // Auto-promote next candidate from waiting queue
      let promotedUser = null;
      if (queue.length > 0) {
        const promotedId = queue.shift();
        allocation[roleKey].push(promotedId);
        allocation.queues[roleKey] = queue;

        if (roleConfig.linkedRole) {
          allocation[roleConfig.linkedRole] = [promotedId];
        }

        try {
          promotedUser = await interaction.client.users.fetch(promotedId);
        } catch {}
      }

      await allocation.save();

      // Live update main flight sheet embed message on Discord
      try {
        const channel = await interaction.client.channels.fetch(allocation.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.edit({
          embeds: [buildMainEmbed(allocation.flight, allocation)],
          components: buildButtons()
        });
      } catch (err) {
        console.warn('Could not update flight sheet embed:', err.message);
      }

      if (promotedUser) {
        try {
          await promotedUser.send(
            `✈️ **LOT Polish Airlines Notice**\n\n` +
            `You have been promoted from the waiting queue to **${roleConfig.label}** for flight **${allocation.flight?.number || 'Flight'}**.`
          );
        } catch {}
      }

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

    // Check 2: Remove from Waiting Queue
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
    await channel.send(`${action} | **Flight ${flightNumber}** | **${role}** | Target: <@${target.id}> | By: <@${admin.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId})`);
  } catch (err) {
    console.warn('Could not send unallocate log:', err.message);
  }
}
