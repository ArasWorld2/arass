const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allocationcall')
    .setDescription('DM unallocated staff an urgent allocation notice for a flight')
    .addStringOption(o => 
      o.setName('flight_number')
        .setDescription('Select or search for the flight allocation')
        .setAutocomplete(true)
        .setRequired(true)
    )
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
      console.error('Autocomplete error in allocationcall:', err);
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('flight_number');

    // 1. Fetch flight from MongoDB
    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Flight allocation record not found in MongoDB.');
    }

    const flight = allocation.flight || {};
    const flightNum = flight.number || 'W6 Flight';
    const dateStr = flight.date || 'Upcoming';

    // 2. Define role mappings and capacity limits
    const roleConfig = [
      { key: 'flightDispatcher', label: 'Flight Dispatcher', group: 'Ground Operations', max: 1 },
      { key: 'flightSupervisor', label: 'Flight Supervisor', group: 'Ground Operations', max: 2 },
      { key: 'captain', label: 'Flight Crew (Captain & First Officer)', group: 'Flight Crew', max: 1 },
      { key: 'firstOfficer', label: 'Flight Crew (Captain & First Officer)', group: 'Flight Crew', max: 1 },
      { key: 'seniorCabinAttendant', label: 'Cabin Crew', group: 'Cabin Crew', max: 1 },
      { key: 'cabinCrew', label: 'Cabin Crew', group: 'Cabin Crew', max: 4 },
      { key: 'turnaroundManager', label: 'Ground Operations / Tarmac Agent', group: 'Ground Operations', max: 1 },
      { key: 'groundCrew', label: 'Ground Operations / Tarmac Agent', group: 'Ground Operations', max: 3 },
      { key: 'customerService', label: 'Ground Operations / Tarmac Agent', group: 'Ground Operations', max: 3 },
      { key: 'bagDropAgent', label: 'Ground Operations / Tarmac Agent', group: 'Ground Operations', max: 3 },
      { key: 'gateAgent', label: 'Ground Operations / Tarmac Agent', group: 'Ground Operations', max: 1 },
      { key: 'loungeAttendant', label: 'Ground Operations / Tarmac Agent', group: 'Ground Operations', max: 2 }
    ];

    // 3. Scan for unfilled categories
    let neededCategoriesSet = new Set();
    
    for (const role of roleConfig) {
      const filledCount = Array.isArray(allocation[role.key]) ? allocation[role.key].length : 0;
      if (filledCount < role.max) {
        neededCategoriesSet.add(role.group);
      }
    }

    let positionsNeededFormatted = '';
    if (neededCategoriesSet.size > 0) {
      positionsNeededFormatted = Array.from(neededCategoriesSet).map(cat => `${cat}`).join('\n\n');
    } else {
      positionsNeededFormatted = 'All positions are currently filled.';
    }

    // 4. Gather all users currently assigned or queued on this flight
    const allocatedUserIds = new Set();
    const docData = allocation.toObject();
    for (const key in docData) {
      if (Array.isArray(docData[key])) {
        docData[key].forEach(id => allocatedUserIds.add(id));
      }
    }
    if (docData.queues) {
      for (const qKey in docData.queues) {
        if (Array.isArray(docData.queues[qKey])) {
          docData.queues[qKey].forEach(id => allocatedUserIds.add(id));
        }
      }
    }

    // 5. DM anyone NOT allocated (No public message sent anywhere)
    let dmCount = 0;
    try {
      await interaction.guild.members.fetch();
      
      for (const [memberId, member] of interaction.guild.members.cache) {
        if (member.user.bot) continue;

        if (!allocatedUserIds.has(memberId)) {
          try {
            await member.user.send({
              content: `:WZZHeart: **Staff Allocation Notice**\n\n` +
                       `We urgently need staff to sign up for flight **${flightNum}** departing on **${dateStr}**.\n` +
                       `Personnel who step up and operate this route will receive an additional **0.5 duty point** included in their payroll.\n\n` +
                       `**Positions Needed:**\n${positionsNeededFormatted}\n\n` +
                       `Please submit your sign-up in <#${allocation.channelId}> if you can cover this.`
            });
            dmCount++;
          } catch {
            // DMs closed or failed
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching guild members for DMs:', err.message);
    }

    return interaction.editReply(
      `✅ Successfully sent private DMs to **${dmCount}** unallocated staff members for flight **${flightNum}** (No public messages were posted)!`
    );
  },
};