const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');

// Custom LOT Emojis
const EMOJIS = {
  TAIL: '<:LOTTail:1520114549490057226>',
  ARROW: '<:LOTSArrow:1520114515318935584>',
  CLICK: '<:leftclick:1520114571124150373>'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dayoftravel')
    .setDescription('Pre-fill and post a Day of Travel Information announcement')
    .addStringOption(o => 
      o.setName('flight_number')
        .setDescription('Select active flight from MongoDB (autofills route & details)')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('aircraft')
        .setDescription('Aircraft name & registration (e.g. B737-800 SP-LVD)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('gate')
        .setDescription('Gate number (Default: Revealed U T H)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('desks')
        .setDescription('Check-in desk range (e.g. C01-C05)')
        .setRequired(false)
    )
    .addBooleanOption(o =>
      o.setName('schengen')
        .setDescription('True to include Schengen border notice')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async autocomplete(interaction) {
    try {
      const focusedValue = (interaction.options.getFocused() || '').trim().toUpperCase();
      const query = focusedValue ? { 'flight.number': { $regex: focusedValue, $options: 'i' } } : {};
      const allocations = await Allocation.find(query).sort({ createdAt: -1 }).limit(10).lean();

      if (!allocations || allocations.length === 0) return await interaction.respond([]).catch(() => {});

      const choices = allocations.map(a => ({
        name: `${a.flight?.number || 'UNKNOWN'} (${a.flight?.from || '???'} ➔ ${a.flight?.to || '???'} | ${a.flight?.date || 'Today'})`,
        value: a.messageId
      }));

      await interaction.respond(choices).catch(() => {});
    } catch (err) {
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
      const messageId = interaction.options.getString('flight_number');
      const allocation = await Allocation.findOne({ messageId });

      const flight = allocation?.flight || {};
      const flightNum = flight.number || 'LO 000';
      const dest = flight.to || 'Destination';
      const aircraft = interaction.options.getString('aircraft') || 'Boeing 737-800 SP-LVD';
      const gate = interaction.options.getString('gate') || 'Revealed U T H';
      const desks = interaction.options.getString('desks') || 'C01-C05';
      const isSchengen = interaction.options.getBoolean('schengen') ?? false;

      let announcementText = 
        `${EMOJIS.TAIL} **Day of Travel Information**\n\n` +
        `**${flightNum} to ${dest}**\n\n` +
        `✈️ **Aircraft**: ${aircraft}\n` +
        `📍 **Gate Number**: ${gate}\n\n` +
        `${EMOJIS.ARROW} Server opens **U T H**. Boarding begins **U T H**.\n`;

      if (isSchengen) {
        announcementText += `${EMOJIS.ARROW} This flight **crosses** the external borders of the Schengen area. Please ensure to have your Passport or National ID Card.\n`;
      }

      announcementText += 
        `${EMOJIS.ARROW} In order to __drop your bags__, please go to check-in at desks **${desks}**.\n` +
        `${EMOJIS.ARROW} You may be refused boarding if you do not have the appropriate travel documents and/or are late.\n\n` +
        `__Z wyrazami szacunku,__\n` +
        `👤 **${interaction.user.username}**\n` +
        `*Flight Operations Department*`;

      // Option to post directly to channel or retrieve pre-filled raw markdown
      const channel = interaction.channel;
      await channel.send({ content: announcementText });

      await interaction.editReply(`✅ **Day of Travel Information** announcement pre-filled and sent to <#${channel.id}>!`);
    } catch (error) {
      console.error('Error executing /dayoftravel:', error);
      await interaction.editReply(`❌ Failed to send announcement: \`${error.message}\``);
    }
  }
};
