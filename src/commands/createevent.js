const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  GuildScheduledEventEntityType, 
  GuildScheduledEventPrivacyLevel, 
  MessageFlags 
} = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createevent')
    .setDescription('Create a native Discord Scheduled Event using MongoDB flight data')
    // 1. Required Autocomplete Flight Choice
    .addStringOption(o => 
      o.setName('flight_number')
        .setDescription('Select or search for an active flight allocation')
        .setAutocomplete(true)
        .setRequired(true)
    )
    // 2. Extra Optional Overrides & Extras
    .addStringOption(o => 
      o.setName('departure_airport')
        .setDescription('Override departure airport name (e.g. Tirana Nënë Tereza Airport)')
        .setRequired(false)
    )
    .addStringOption(o => 
      o.setName('start_timestamp')
        .setDescription('Unix timestamp for start in seconds (Overrides flight time)')
        .setRequired(false)
    )
    .addStringOption(o => 
      o.setName('end_timestamp')
        .setDescription('Unix timestamp for end in seconds (Defaults to 1 hour after start)')
        .setRequired(false)
    )
    .addAttachmentOption(o => 
      o.setName('image')
        .setDescription('Upload a cover banner image for the Discord Event')
        .setRequired(false)
    )
    .addStringOption(o => 
      o.setName('operator')
        .setDescription('Operator name or emoji (Default: Wizz Air Malta)')
        .setRequired(false)
    )
    .addStringOption(o => 
      o.setName('event_guild_id')
        .setDescription('Target Server ID (Overrides process.env.EVENT_GUILD_ID)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  // Autocomplete Handler fetching allocations from MongoDB
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
      console.error('Autocomplete error in createevent:', err);
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('flight_number');

    // 1. Fetch Flight Record from MongoDB
    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Flight allocation record not found in MongoDB database.');
    }

    const flight = allocation.flight || {};

    // 2. Resolve Flight Details (Command options fallback to MongoDB values)
    const flightNumber = flight.number || 'W6 Flight';
    const depCode = flight.from || 'DEP';
    const arrCode = flight.to || 'ARR';
    const route = `${depCode} ➔ ${arrCode}`;
    const departureAirport = interaction.options.getString('departure_airport') || `${depCode} Airport`;
    const operator = interaction.options.getString('operator') || '<:wizzmalta:1272674839441965056> Wizz Air Malta';

    // 3. Resolve Event Start and End Timestamps
    const customStartTs = interaction.options.getString('start_timestamp');
    const customEndTs = interaction.options.getString('end_timestamp');

    let startTs = customStartTs ? parseInt(customStartTs, 10) : Math.floor(Date.now() / 1000) + 3600; // Fallback: +1 Hour from now
    let endTs = customEndTs ? parseInt(customEndTs, 10) : startTs + 3600; // Fallback: 1 Hour duration

    const startTime = new Date(startTs * 1000);
    const endTime = new Date(endTs * 1000);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return interaction.editReply('❌ Invalid timestamp provided for event start or end time.');
    }

    // 4. Resolve Target Discord Server Guild
    const targetGuildId = interaction.options.getString('event_guild_id') || process.env.EVENT_GUILD_ID;
    let targetGuild = interaction.guild;

    if (targetGuildId) {
      try {
        targetGuild = await interaction.client.guilds.fetch(targetGuildId);
      } catch {
        return interaction.editReply(`❌ Could not fetch target server with ID \`${targetGuildId}\`. Check Railway variables or server ID.`);
      }
    }

    // 5. Handle Uploaded Cover Banner Image
    const imageAttachment = interaction.options.getAttachment('image');
    let imageBuffer = null;

    if (imageAttachment) {
      try {
        const response = await fetch(imageAttachment.url);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } catch (err) {
        console.warn('Failed to process uploaded image attachment:', err.message);
      }
    }

    // 6. Dynamic Hammertime Formatting
    const dateHammertime = `<t:${startTs}:F>`;
    const timeHammertime = `<t:${startTs}:t>`;

    // 7. Build Description
    const description = 
      `<:takeoff:1414277645134200955> **${flightNumber}** has been scheduled and is set to depart from **${departureAirport}**. For more details and information in regards to your departure, please click here.\n\n` +
      `**Flight Number:** ${flightNumber}\n` +
      `**Date:** ${dateHammertime}\n` +
      `**Departure Time:** ${timeHammertime}\n` +
      `**Route:** ${route}\n` +
      `**Operator:** ${operator}`;

    try {
      // 8. Create Native Discord Guild Scheduled Event
      const event = await targetGuild.scheduledEvents.create({
        name: flightNumber,
        description: description,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: {
          location: departureAirport,
        },
        image: imageBuffer || null,
      });

      return interaction.editReply(`✅ Scheduled Event **${event.name}** created successfully in **${targetGuild.name}**!\n🔗 [View Event](${event.url})`);
    } catch (err) {
      console.error('Failed to create scheduled event:', err);
      return interaction.editReply(`❌ Failed to create scheduled event in **${targetGuild.name}**: \`${err.message}\``);
    }
  },
};