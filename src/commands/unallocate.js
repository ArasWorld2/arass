const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

// Complete mapping of short keys to exact MongoDB schema field names
const KEY_ALIASES = {
  dc: ['dispatchCoordinator', 'dc', 'departureCoordinator', 'departure_coordinator', 'DC'],
  mb: ['dispatchSupervisor', 'flightSupervisor', 'mb', 'managementBoard', 'management_board'],
  cpt: ['captain', 'cpt', 'CPT'],
  fo: ['firstOfficer', 'fo', 'FO'],
  stbyFd: ['stbyFd', 'standbyFlightDeck', 'stby_fd'],
  purser: ['purser', 'Purser'],
  cc: ['cabinCrew', 'cc', 'cabin_crew', 'CC'],
  stbyCc: ['stbyCc', 'standbyCabinCrew', 'stby_cc'],
  ts: ['tarmacSupervisor', 'ts', 'tarmac_supervisor'],
  gc: ['groundHandling', 'gc', 'groundCrew', 'ground_crew'],
  stbyGc: ['stbyGc', 'standbyGroundCrew', 'stby_gc'],
  bcbd: ['bagDropAgent', 'bcbd', 'businessBagDrop', 'businessClassBagDrop'],
  ecbd: ['bagDropAgent', 'ecbd', 'economyBagDrop', 'economyClassBagDrop'],
  cs: ['cs', 'customerService', 'customer_service'],
  gate: ['gateAgent', 'gate', 'gate_agent'],
  lounge: ['loungeAttendant', 'lounge']
};

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

  async autocomplete(interaction) {
    try {
      const focusedValue = (interaction.options.getFocused() || '').trim().toUpperCase();

      const query = focusedValue 
        ? { 'flight.number': { $regex: focusedValue, $options: 'i' } } 
        : {};

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
          value: a.messageId
        };
      });

      await interaction.respond(choices).catch(() => {});
    } catch (err) {
      console.error('Autocomplete error in unallocate:', err);
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('flight_number');
    const user      = interaction.options.getUser('user');
    const rawRole   = interaction.options.getString('role');

    const roleConfig = getRoleConfig(rawRole.replace(/^(alloc_|join_)/, ''));
    const roleKey    = roleConfig.key;

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Allocation sheet not found in database.');
    }

    if (allocation.isLocked) {
      return interaction.editReply('🔒 **Allocation Error:** This timetable schedule is currently locked. No modifications or unallocations are permitted.');
    }

    const possibleKeys = KEY_ALIASES[roleKey] || [roleKey];
    let matchedKey = null;
    let isAllocated = false;

    const rawDoc = allocation.toObject ? allocation.toObject() : allocation;

    // Search through schema fields
    for (const key of possibleKeys) {
      const val = rawDoc[key];
      if (val) {
        if (Array.isArray(val) && val.includes(user.id)) {
          matchedKey = key;
          isAllocated = true;
          break;
        } else if (typeof val === 'string' && val === user.id) {
          matchedKey = key;
          isAllocated = true;
          break;
        }
      }
    }

    // Search queues
    if (!allocation.queues) allocation.queues = {};
    let matchedQueueKey = null;
    let isInQueue = false;

    for (const key of possibleKeys) {
      const qVal = allocation.queues[key];
      if (qVal && Array.isArray(qVal) && qVal.includes(user.id)) {
        matchedQueueKey = key;
        isInQueue = true;
        break;
      }
    }

    // 1. Remove from active slot
    if (isAllocated && matchedKey) {
      if (Array.isArray(allocation[matchedKey])) {
        allocation[matchedKey] = allocation[matchedKey].filter(id => id !== user.id);
      } else {
        allocation[matchedKey] = [];
      }

      // Keep alternative keys in sync
      possibleKeys.forEach(k => {
        if (Array.isArray(allocation[k])) {
          allocation[k] = allocation[k].filter(id => id !== user.id);
        }
      });

      // Promote from queue if present
      const queueKey = matchedQueueKey || roleKey;
      if (allocation.queues[queueKey] && allocation.queues[queueKey].length > 0) {
        const promotedId = allocation.queues[queueKey].shift();

        if (Array.isArray(allocation[matchedKey])) {
          allocation[matchedKey].push(promotedId);
        } else {
          allocation[matchedKey] = [promotedId];
        }

        try {
          const promotedUser = await interaction.client.users.fetch(promotedId);
          await promotedUser.send(
            `✈️ **LOT Polish Airlines Notice**\n\n` +
            `You have been promoted from the waiting queue to **${roleConfig.label}** for flight **${allocation.flight?.number || 'Flight'}**.`
          ).catch(() => {});
        } catch {}
      }

      await allocation.save();

      // Update Discord embed
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

    // 2. Remove from queue
    if (isInQueue && matchedQueueKey) {
      allocation.queues[matchedQueueKey] = allocation.queues[matchedQueueKey].filter(id => id !== user.id);
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
