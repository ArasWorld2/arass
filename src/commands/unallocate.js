const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

// Map role keys to alternative schema property names if legacy fields exist in MongoDB
const KEY_ALIASES = {
  dc: ['dc', 'departureCoordinator', 'departure_coordinator', 'DC'],
  mb: ['mb', 'managementBoard', 'management_board'],
  cpt: ['cpt', 'captain', 'CPT'],
  fo: ['fo', 'firstOfficer', 'first_officer', 'FO'],
  stbyFd: ['stbyFd', 'standbyFlightDeck', 'stby_fd'],
  purser: ['purser', 'Purser'],
  cc: ['cc', 'cabinCrew', 'cabin_crew', 'CC'],
  stbyCc: ['stbyCc', 'standbyCabinCrew', 'stby_cc'],
  ts: ['ts', 'tarmacSupervisor', 'tarmac_supervisor'],
  gc: ['gc', 'groundCrew', 'ground_crew'],
  stbyGc: ['stbyGc', 'standbyGroundCrew', 'stby_gc'],
  bcbd: ['bcbd', 'businessBagDrop', 'businessClassBagDrop'],
  ecbd: ['ecbd', 'economyBagDrop', 'economyClassBagDrop'],
  cs: ['cs', 'customerService', 'customer_service'],
  gate: ['gate', 'gateAgent', 'gate_agent'],
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
      console.error('[UNALLOCATE DEBUG] Autocomplete error:', err);
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
      console.error(`[UNALLOCATE DEBUG] ❌ Record not found in MongoDB for messageId: ${messageId}`);
      return interaction.editReply('❌ Allocation sheet not found in database.');
    }

    if (allocation.isLocked) {
      return interaction.editReply('🔒 **Allocation Error:** This timetable schedule is currently locked. No modifications or unallocations are permitted.');
    }

    // Get all potential alias keys for this role
    const possibleKeys = KEY_ALIASES[roleKey] || [roleKey];
    let matchedKey = null;
    let isAllocated = false;

    // Convert document to plain object for debug inspection
    const rawDoc = allocation.toObject ? allocation.toObject() : allocation;

    // Search through potential schema properties to find where the user ID is stored
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

    // Check waiting queues
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

    // 🔴 DEBUG OUTPUT IF USER NOT FOUND
    if (!isAllocated && !isInQueue) {
      console.error('==================== [UNALLOCATE DEBUG ERROR] ====================');
      console.error(`Target User ID:    ${user.id} (@${user.tag || user.username})`);
      console.error(`Requested Role:    "${roleConfig.label}" (key: "${roleKey}")`);
      console.error(`Keys Searched:     [${possibleKeys.join(', ')}]`);
      console.error(`Message ID:        ${messageId}`);
      console.error('--- Document Role Fields Dump ---');
      possibleKeys.forEach(k => {
        console.error(`  - doc['${k}']:`, JSON.stringify(rawDoc[k]));
      });
      console.error('--- Full Top-Level Document Keys ---');
      console.error(Object.keys(rawDoc));
      console.error('==================================================================');
    }

    // 1. Remove from active slot
    if (isAllocated && matchedKey) {
      if (Array.isArray(allocation[matchedKey])) {
        allocation[matchedKey] = allocation[matchedKey].filter(id => id !== user.id);
      } else {
        allocation[matchedKey] = [];
      }

      // Also ensure main roleKey array is updated
      if (matchedKey !== roleKey && Array.isArray(allocation[roleKey])) {
        allocation[roleKey] = allocation[roleKey].filter(id => id !== user.id);
      }

      // Promote next person from queue if available
      const queueKey = matchedQueueKey || roleKey;
      if (allocation.queues[queueKey] && allocation.queues[queueKey].length > 0) {
        const promotedId = allocation.queues[queueKey].shift();

        if (Array.isArray(allocation[roleKey])) {
          allocation[roleKey].push(promotedId);
        } else {
          allocation[roleKey] = [promotedId];
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

      // Refresh embed message
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
