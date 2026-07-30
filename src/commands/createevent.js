const { SlashCommandBuilder, PermissionFlagsBits, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, MessageFlags } = require('discord.js');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createevent')
    .setDescription('Create a native Discord Scheduled Event for a flight departure')
    .addStringOption(o => o.setName('flight_number').setDescription('Flight number (e.g. W4 5161)').setRequired(true))
    .addStringOption(o => o.setName('departure_airport').setDescription('Departure airport name (e.g. Tirana Nënë Tereza Airport)').setRequired(true))
    .addStringOption(o => o.setName('route').setDescription('Flight route (e.g. TIA → LCA)').setRequired(true))
    .addStringOption(o => o.setName('start_timestamp').setDescription('Unix timestamp for event start in seconds (e.g. 1780592400)').setRequired(true))
    .addStringOption(o => o.setName('end_timestamp').setDescription('Unix timestamp for event end in seconds (e.g. 1780596000)').setRequired(true))
    .addStringOption(o => o.setName('operator').setDescription('Operator name or emoji (e.g. <:wizzmalta:123456> Wizz Air Malta)').setRequired(false))
    .addStringOption(o => o.setName('event_guild_id').setDescription('Target Server ID (overrides EVENT_GUILD_ID in Railway variables)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const flightNumber     = interaction.options.getString('flight_number').toUpperCase();
    const departureAirport = interaction.options.getString('departure_airport');
    const route            = interaction.options.getString('route');
    const startTs          = parseInt(interaction.options.getString('start_timestamp'), 10);
    const endTs            = parseInt(interaction.options.getString('end_timestamp'), 10);
    const operator         = interaction.options.getString('operator') || '<:wizzmalta:1272674839441965056> Wizz Air Malta';
    
    // Priority: Command Option -> Railway process.env.EVENT_GUILD_ID -> Command execution Guild
    const targetGuildId = interaction.options.getString('event_guild_id') || process.env.EVENT_GUILD_ID;

    let targetGuild = interaction.guild;
    if (targetGuildId) {
      try {
        targetGuild = await interaction.client.guilds.fetch(targetGuildId);
      } catch {
        return interaction.editReply(`❌ Could not find or access server with ID \`${targetGuildId}\`. Check your Railway variables or server ID.`);
      }
    }

    // Convert timestamps to ISO Date objects for Discord API
    const startTime = new Date(startTs * 1000);
    const endTime   = new Date(endTs * 1000);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return interaction.editReply('❌ Invalid Unix timestamp provided for start or end time.');
    }

    // Dynamic Hammertime formatting:
    // <t:startTs:F> -> Full Date & Time (e.g., Thursday, June 4, 2026 5:00 PM)
    // <t:startTs:t> -> Short Time (e.g., 17:00)
    const dateHammertime = `<t:${startTs}:F>`;
    const timeHammertime = `<t:${startTs}:t>`;

    // Build event description matching your exact screenshot format
    const description = 
      `<:takeoff:1414277645134200955> **${flightNumber}** has been scheduled and is set to depart from **${departureAirport}**. For more details and information in regards to your departure, please click here.\n\n` +
      `**Flight Number:** ${flightNumber}\n` +
      `**Date:** ${dateHammertime}\n` +
      `**Departure Time:** ${timeHammertime}\n` +
      `**Route:** ${route}\n` +
      `**Operator:** ${operator}`;

    try {
      // Create Discord Scheduled Event in target guild
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
      });

      return interaction.editReply(`✅ Scheduled event **${event.name}** created successfully in **${targetGuild.name}**! [View Event](${event.url})`);
    } catch (err) {
      console.error('Failed to create scheduled event:', err);
      return interaction.editReply(`❌ Failed to create scheduled event in **${targetGuild.name}**: \`${err.message}\``);
    }
  },
};