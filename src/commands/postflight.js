const { SlashCommandBuilder } = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildFlightEmbed, buildAllocationEmbed, buildButtons } = require('../utils/embeds');
const { scheduleReminders } = require('../utils/reminder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postflight')
    .setDescription('Post a new flight allocation sheet')
    .addStringOption(o => o.setName('number').setDescription('Flight number, e.g. TG216').setRequired(true))
    .addStringOption(o => o.setName('from').setDescription('Departure airport code, e.g. HKT').setRequired(true))
    .addStringOption(o => o.setName('to').setDescription('Arrival airport code, e.g. BKK').setRequired(true))
    .addStringOption(o => o.setName('staff_time').setDescription('Staff joining time, e.g. Saturday, 9 May 2026 12:15').setRequired(true))
    .addStringOption(o => o.setName('passenger_time').setDescription('Passenger joining time, e.g. Saturday, 9 May 2026 12:30').setRequired(true))
    .addStringOption(o => o.setName('aircraft').setDescription('Aircraft type, e.g. A350-900').setRequired(true))
    .addStringOption(o => o.setName('staff_time_utc').setDescription('Actual staff time for reminder scheduling, e.g. 2026-05-09 12:15').setRequired(false))
    .addIntegerOption(o => o.setName('reminder_minutes').setDescription('Minutes before staff time to send DM reminder (default: 15)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const flight = {
      number:        interaction.options.getString('number').toUpperCase(),
      from:          interaction.options.getString('from').toUpperCase(),
      to:            interaction.options.getString('to').toUpperCase(),
      staffTime:     interaction.options.getString('staff_time'),
      passengerTime: interaction.options.getString('passenger_time'),
      aircraft:      interaction.options.getString('aircraft'),
      staffTimeUtc:  interaction.options.getString('staff_time_utc') || null,
    };

    const reminderMinutes = interaction.options.getInteger('reminder_minutes') ?? 15;

    const flightEmbed     = buildFlightEmbed(flight);
    const allocationEmbed = buildAllocationEmbed({ ...flight, queues: {} });
    const buttons         = buildButtons();

    const message = await interaction.channel.send({
      embeds: [flightEmbed, allocationEmbed],
      components: buttons,
    });

    const allocation = await Allocation.create({
      messageId: message.id,
      channelId: interaction.channelId,
      flight,
    });

    // Schedule DM reminders
    scheduleReminders(interaction.client, allocation, reminderMinutes);

    const reminderNote = flight.staffTimeUtc
      ? `DM reminders will be sent **${reminderMinutes} minutes** before staff joining time.`
      : `⚠️ No \`staff_time_utc\` provided — DM reminders will not be sent.`;

    await interaction.editReply(`✅ Flight **${flight.number}** posted! ${reminderNote}`);
  },
};
