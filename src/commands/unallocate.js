const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

// Complete mapping of short keys <-> full schema field names
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
      return interaction.editReply('🔒 **Allocation Error:** This timetable schedule is currently locked.');
    }

    const possibleKeys = KEY_ALIASES[roleKey] || [roleKey];
    let isAllocated = false;

    // 1. Wipe target user from ALL matching key variants across the document
    possibleKeys.forEach(k => {
      if (allocation[k]) {
        if (Array.isArray(allocation[k])) {
          if (allocation[k].includes(user.id)) isAllocated = true;
          allocation[k] = allocation[k].filter(id => id !== user.id);
        } else if (allocation[k] === user.id) {
          isAllocated = true;
          allocation[k] = [];
        }
        allocation.markModified(k);
      }
    });

    // 2. Check and clean queue
    if (!allocation.queues) allocation.queues = {};
    let isInQueue = false;

    possibleKeys.forEach(k => {
      if (allocation.queues[k] && Array.isArray(allocation.queues[k])) {
        if (allocation.queues[k].includes(user.id)) isInQueue = true;
        allocation.queues[k] = allocation.queues[k].filter(id => id !== user.id);
      }
    });
    allocation.markModified('queues');

    if (!isAllocated && !isInQueue) {
      return interaction.editReply(`❌ <@${user.id}> is not in **${roleConfig.label}**.`);
    }

    await allocation.save();

    // 3. Re-fetch fresh document to ensure embed has synced values
    const updatedAllocation = await Allocation.findOne({ messageId });

    // Update main Discord embed sheet
    try {
      const channel = await interaction.client.channels.fetch(updatedAllocation.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.edit({
        embeds: [buildMainEmbed(updatedAllocation.flight, updatedAllocation)],
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
      flightNumber: updatedAllocation.flight?.number || 'Unknown',
      messageId,
    });

    return interaction.editReply(`✅ Removed <@${user.id}> from **${roleConfig.label}**.`);
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
