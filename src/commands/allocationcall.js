const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

// Custom LOT Emojis
const EMOJIS = {
  TAIL: '<:LOTTail:1520114549490057226>',
  ARROW: '<:LOTSArrow:1520114515318935584>',
  HEART: '<:LOTSHeart:1520114525586849985>',
  CLICK: '<:leftclick:1520114571124150373>'
};

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
    const flightNum = flight.number || 'LO Flight';
    const dateStr = flight.date || 'Upcoming';

    // 2. Define LOT Polish Airlines role mappings and capacity limits
    const roleConfig = [
      { keys: ['dc', 'dispatchCoordinator', 'departureCoordinator'], label: 'Departure Coordinator', group: 'Flight Management', max: 1 },
      { keys: ['mb', 'dispatchSupervisor', 'flightSupervisor', 'managementBoard'], label: 'Management Board', group: 'Flight Management', max: 10 },
      { keys: ['cpt', 'captain'], label: 'Captain', group: 'Flight Deck', max: 1 },
      { keys: ['fo', 'firstOfficer'], label: 'First Officer', group: 'Flight Deck', max: 1 },
      { keys: ['stbyFd', 'standbyFlightDeck'], label: 'Stand-by Flight Deck', group: 'Flight Deck', max: 10 },
      { keys: ['purser'], label: 'Purser', group: 'Cabin Crew', max: 1 },
      { keys: ['cc', 'cabinCrew'], label: 'Cabin Crew', group: 'Cabin Crew', max: 3 },
      { keys: ['stbyCc', 'standbyCabinCrew'], label: 'Stand-by Cabin Crew', group: 'Cabin Crew', max: 10 },
      { keys: ['ts', 'tarmacSupervisor'], label: 'Tarmac Supervisor', group: 'Ground Crew', max: 1 },
      { keys: ['gc', 'groundHandling', 'groundCrew'], label: 'Ground Crew', group: 'Ground Crew', max: 3 },
      { keys: ['stbyGc', 'standbyGroundCrew'], label: 'Stand-by Ground Crew', group: 'Ground Crew', max: 10 },
      { keys: ['bcbd', 'bagDropAgent', 'businessClassBagDrop'], label: 'Business Class Bag Drop', group: 'Airport Worker', max: 1 },
      { keys: ['ecbd', 'economyBagDrop', 'economyClassBagDrop'], label: 'Economy Class Bag Drop', group: 'Airport Worker', max: 3 },
      { keys: ['cs', 'customerService'], label: 'Customer Service', group: 'Airport Worker', max: 2 },
      { keys: ['gate', 'gateAgent'], label: 'Gate Agent', group: 'Airport Worker', max: 1 }
    ];

    // 3. Scan for unfilled categories
    const neededCategoriesSet = new Set();
    
    for (const role of roleConfig) {
      let filledCount = 0;
      for (const key of role.keys) {
        if (Array.isArray(allocation[key])) {
          filledCount += allocation[key].length;
        }
      }
      if (filledCount < role.max) {
        neededCategoriesSet.add(role.group);
      }
    }

    let positionsNeededFormatted = '';
    if (neededCategoriesSet.size > 0) {
      positionsNeededFormatted = Array.from(neededCategoriesSet).map(cat => `${EMOJIS.ARROW} ${cat}`).join('\n');
    } else {
      positionsNeededFormatted = `${EMOJIS.ARROW} All positions are currently filled.`;
    }

    // 4. Gather all users currently assigned or queued on this flight
    const allocatedUserIds = new Set();
    const docData = allocation.toObject();
    for (const key in docData) {
      if (Array.isArray(docData[key])) {
        docData[key].forEach(id => allocatedUserIds.add(id.toString()));
      }
    }
    if (docData.queues) {
      for (const qKey in docData.queues) {
        if (Array.isArray(docData.queues[qKey])) {
          docData.queues[qKey].forEach(id => allocatedUserIds.add(id.toString()));
        }
      }
    }

    // 5. Build LOT-themed Call-Out DM Embed
    const callEmbed = new EmbedBuilder()
      .setColor('#0C2340') // LOT Polish Airlines Navy Blue
      .setTitle(`${EMOJIS.TAIL} **LOT Polish Airlines • Urgent Staff Allocation Notice**`)
      .setDescription(
        `${EMOJIS.ARROW} We urgently require staff to allocate for **${flightNum}** scheduled for **${dateStr}**.\n` +
        `> Personnel stepping up to cover this route will receive an additional **0.5 duty credit** on their operational record.\n\n` +
        `${EMOJIS.HEART} **Departments Requiring Support:**\n${positionsNeededFormatted}\n\n` +
        `${EMOJIS.CLICK} Please head to <#${allocation.channelId}> to select your duty role.`
      )
      .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
      .setTimestamp();

    // 6. DM non-allocated staff members
    let dmCount = 0;
    try {
      await interaction.guild.members.fetch();
      
      for (const [memberId, member] of interaction.guild.members.cache) {
        if (member.user.bot) continue;

        if (!allocatedUserIds.has(memberId)) {
          try {
            await member.user.send({ embeds: [callEmbed] });
            dmCount++;
          } catch {
            // User DMs are closed or disabled
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching guild members for DMs:', err.message);
    }

    return interaction.editReply(
      `✅ Successfully dispatched LOT allocation notices via private DM to **${dmCount}** unallocated staff members for flight **${flightNum}**!`
    );
  },
};
