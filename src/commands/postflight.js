const { SlashCommandBuilder } = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons } = require('../utils/embeds');
const { scheduleReminders } = require('../utils/reminder');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postflight')
    .setDescription('Post a new Wizz Air flight allocation sheet')
    .addStringOption(o => o.setName('number').setDescription('Flight number, e.g. W62341').setRequired(true))
    .addStringOption(o => o.setName('from').setDescription('Departure airport, e.g. London Luton Airport').setRequired(true))
    .addStringOption(o => o.setName('to').setDescription('Arrival airport, e.g. Budapest Airport').setRequired(true))
    .addStringOption(o => o.setName('staff_time').setDescription('Duty report time, e.g. <t:1234567890:t> or 19:40').setRequired(true))
    .addStringOption(o => o.setName('passenger_time').setDescription('Passenger report time, e.g. 20:00').setRequired(true))
    .addStringOption(o => o.setName('aircraft').setDescription('Aircraft type, e.g. Airbus A321neo').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('Flight date, e.g. 10 May 2026').setRequired(false))
    .addStringOption(o => o.setName('gate').setDescription('Departure gate, e.g. B12').setRequired(false))
    .addStringOption(o => o.setName('boarding_time').setDescription('Boarding time, e.g. 10:00').setRequired(false))
    .addStringOption(o => o.setName('operations_closure').setDescription('Operations closure time, e.g. 10:15').setRequired(false)),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const flight = {
      number:        interaction.options.getString('number').toUpperCase(),
      from:          interaction.options.getString('from'),
      to:            interaction.options.getString('to'),
      staffTime:     interaction.options.getString('staff_time'),
      passengerTime: interaction.options.getString('passenger_time'),
      aircraft:      interaction.options.getString('aircraft'),
      date:          interaction.options.getString('date') || new Date().toDateString(),
      staffTimeUtc:  interaction.options.getString('staff_time_utc') || null,
    };

    const reminderMinutes = interaction.options.getInteger('reminder_minutes') ?? 15;
    const embed   = buildMainEmbed(flight, {});
    const buttons = buildButtons();

    const message = await interaction.channel.send({
      embeds: [embed],
      components: buttons,
    });

    const allocation = await Allocation.create({
      messageId: message.id,
      channelId: interaction.channelId,
      flight,
    });

    if (flight.staffTimeUtc) {
      scheduleReminders(interaction.client, allocation, reminderMinutes);
    }

    const reminderNote = flight.staffTimeUtc
      ? `DM reminders will be sent **${reminderMinutes} minutes** before duty report time.`
      : `No \`staff_time_utc\` provided — DM reminders disabled.`;

    await interaction.editReply(`✅ Flight **${flight.number}** posted! ${reminderNote}`);
  },
};
