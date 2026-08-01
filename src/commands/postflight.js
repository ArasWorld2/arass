const { 
  SlashCommandBuilder, 
  MessageFlags, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons } = require('../utils/embeds');
const { scheduleReminders } = require('../utils/reminder');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postflight')
    .setDescription('Post a new Wizz Air flight allocation sheet into a new personnel flight channel')
    .addStringOption(o => o.setName('number').setDescription('Flight number, e.g. W62341').setRequired(true))
    .addStringOption(o => o.setName('from').setDescription('Departure airport, e.g. London Luton Airport').setRequired(true))
    .addStringOption(o => o.setName('to').setDescription('Arrival airport, e.g. Budapest Airport').setRequired(true))
    .addStringOption(o => o.setName('staff_time').setDescription('Duty report time, e.g. 19:40').setRequired(true))
    .addStringOption(o => o.setName('passenger_time').setDescription('Passenger report time, e.g. 20:00').setRequired(true))
    .addStringOption(o => o.setName('aircraft').setDescription('Aircraft type, e.g. Airbus A321neo').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('Flight date, e.g. 10 May 2026').setRequired(false))
    .addStringOption(o => o.setName('gate').setDescription('Departure gate, e.g. B12').setRequired(false))
    .addStringOption(o => o.setName('boarding_time').setDescription('Boarding time, e.g. 10:00').setRequired(false))
    .addStringOption(o => o.setName('operations_closure').setDescription('Operations closure time, e.g. 10:15').setRequired(false))
    .addIntegerOption(o => o.setName('reminder_minutes').setDescription('Minutes before staff_time to send DMs (Default: 15)').setRequired(false)),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
      const flight = {
        number:            interaction.options.getString('number').toUpperCase(),
        from:              interaction.options.getString('from'),
        to:                interaction.options.getString('to'),
        staffTime:         interaction.options.getString('staff_time'),
        passengerTime:     interaction.options.getString('passenger_time'),
        aircraft:          interaction.options.getString('aircraft'),
        date:              interaction.options.getString('date') || new Date().toDateString(),
        gate:              interaction.options.getString('gate') || 'TBA',
        boardingTime:      interaction.options.getString('boarding_time') || 'TBA',
        operationsClosure: interaction.options.getString('operations_closure') || 'TBA',
      };

      const reminderMinutes = interaction.options.getInteger('reminder_minutes') ?? 15;
      const embed   = buildMainEmbed(flight, {});
      const buttons = buildButtons();

      // 1. Fetch Personnel Server and create dedicated channel
      const personnelGuildId = process.env.PERSONNEL_GUILD_ID || interaction.guildId;
      const flightCategoryId = process.env.FLIGHT_CATEGORY_ID;

      const personnelGuild = await interaction.client.guilds.fetch(personnelGuildId);
      const channelName = flight.number.toLowerCase().replace(/[^a-z0-9]/g, '-');

      const flightChannel = await personnelGuild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: flightCategoryId || null,
        topic: `Flight Operations channel for ${flight.number} (${flight.from} → ${flight.to})`,
      });

      // 2. Post the main flight sheet directly inside the newly created flight channel
      const mainMessage = await flightChannel.send({
        embeds: [embed],
        components: buttons,
      });

      // 3. Post the Flight Deck Selection Embed
      const fdEmbed = new EmbedBuilder()
        .setColor('#D3007F')
        .setTitle('<:plane:1414277643314004079> Flight Deck Allocation Pool')
        .setDescription(
          `Click below to register for **Captain** or **First Officer** for flight **${flight.number}**.\n\n` +
          `A host will run \`/choosefd\` to randomly select assigned pilots from this pool.\n\n` +
          `• **Captain Candidates:** 0\n` +
          `• **First Officer Candidates:** 0`
        )
        .setFooter({ text: 'Wizz Air Flight Operations • Flight Deck Selection' });

      const fdRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`fd_apply_cpt_${mainMessage.id}`)
          .setLabel('Apply Captain (CPT)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`fd_apply_fo_${mainMessage.id}`)
          .setLabel('Apply First Officer (FO)')
          .setStyle(ButtonStyle.Secondary)
      );

      const fdMessage = await flightChannel.send({ embeds: [fdEmbed], components: [fdRow] });

      // 4. Save to MongoDB referencing the channel, main message, and FD message
      const allocation = await Allocation.create({
        messageId: mainMessage.id,
        channelId: flightChannel.id,
        flight,
        isLocked: false,
        cptPool: [],
        foPool: [],
        fdChoiceMessageId: fdMessage.id,
      });

      console.log(`[POSTFLIGHT] Stored flight ${flight.number} in DB (Doc ID: ${allocation._id})`);

      if (flight.staffTimeUtc && typeof scheduleReminders === 'function') {
        scheduleReminders(interaction.client, allocation, reminderMinutes);
      }

      await interaction.editReply(`✅ Created channel <#${flightChannel.id}> and posted flight sheet for **${flight.number}**!`);

    } catch (error) {
      console.error('❌ Error executing /postflight:', error);
      await interaction.editReply(`❌ Failed to create channel and post allocation sheet: \`${error.message}\``);
    }
  },
};