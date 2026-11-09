const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');

// Custom LOT Emojis
const EMOJIS = {
  TAIL: '<:LOTTail:1520114549490057226>',
  ARROW1: '<:LOTSArrow:1520114515318935584>',
  ARROW2: '<:LOTSArrow:1520114515318935584>',
  MANAGER: '<:LOTSManager:1520114571124150373>',
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
        .setDescription('Aircraft name & registration (e.g. Boeing 737-800 SP-LVD)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('gate')
        .setDescription('Gate number (Default: Revealed U T H)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('server_opens')
        .setDescription('Server opening time / timestamp (Default: U T H)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('boarding_begins')
        .setDescription('Boarding time / timestamp (Default: U T H)')
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
    .addStringOption(o =>
      o.setName('department')
        .setDescription('Department name for signature (Default: Flight Operations Department)')
        .setRequired(false)
    )
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Target channel to post announcement (Defaults to DEPARTURES_CHANNEL_ID)')
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
      const dest = flight.to || '__Destination__';

      // Custom parameters or fallback defaults
      const aircraft = interaction.options.getString('aircraft') || 'Boeing 737-800 SP-LVD';
      const gate = interaction.options.getString('gate') || 'Revealed U T H';
      const serverOpens = interaction.options.getString('server_opens') || '__U T H__';
      const boardingBegins = interaction.options.getString('boarding_begins') || '__U T H__';
      const desks = interaction.options.getString('desks') || 'X-Y';
      const isSchengen = interaction.options.getBoolean('schengen') ?? false;
      const department = interaction.options.getString('department') || 'Flight Operations Department';

      // Build announcement with exact formatting requested
      let announcementText = 
        `${EMOJIS.TAIL} **Day of Travel Information**\n` +
        `**${flightNum} to ${dest}**\n\n` +
        `${EMOJIS.ARROW2}  **Aircraft**: ${aircraft}\n` +
        `${EMOJIS.ARROW2}  **Gate Number**: ${gate}\n\n` +
        `${EMOJIS.ARROW1}Server opens ${serverOpens}. Boarding begins ${boardingBegins}.\n`;

      if (isSchengen) {
        announcementText += `${EMOJIS.ARROW1}This flight **crosses** the external borders of the Schengen area. Please ensure to have your Passport or National ID Card.\n`;
      }

      announcementText += 
        `${EMOJIS.ARROW1}In order to __drop your bags__, please go to check-in at desks **${desks}**.\n` +
        `${EMOJIS.ARROW1}You may be refused boarding if you do not have the appropriate travel documents and/or are late.\n\n` +
        `__Z wyrazami szacunku,__\n` +
        `${EMOJIS.MANAGER} **${interaction.user.username}**\n` +
        `*${department}*`;

      // Target channel resolution
      const targetChannel = interaction.options.getChannel('channel') || 
                            (process.env.DEPARTURES_CHANNEL_ID ? await interaction.client.channels.fetch(process.env.DEPARTURES_CHANNEL_ID).catch(() => null) : null) || 
                            interaction.channel;

      const sentMsg = await targetChannel.send({ content: announcementText });

      await interaction.editReply(`✅ **Day of Travel Information** announcement successfully posted to <#${targetChannel.id}>!`);

    } catch (error) {
      console.error('Error executing /dayoftravel:', error);
      await interaction.editReply(`❌ Failed to send announcement: \`${error.message}\``);
    }
  }
};
