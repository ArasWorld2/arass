const { SlashCommandBuilder, MessageFlags } = require('discord.js');
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

            // 1. Post to Discord Channel
            const message = await interaction.channel.send({
                embeds: [embed],
                components: buttons,
            });

            // 2. Save to MongoDB
            const allocation = await Allocation.create({
                messageId: message.id,
                channelId: interaction.channelId,
                flight,
                isLocked: false
            });

            console.log(`[POSTFLIGHT] Stored flight ${flight.number} in DB (Doc ID: ${allocation._id} | Msg ID: ${message.id})`);

            if (flight.staffTimeUtc && typeof scheduleReminders === 'function') {
                scheduleReminders(interaction.client, allocation, reminderMinutes);
            }

            const reminderNote = flight.staffTimeUtc
                ? `DM reminders scheduled **${reminderMinutes} minutes** prior.`
                : `No \`staff_time_utc\` provided — DM reminders disabled.`;

            await interaction.editReply(`✅ Flight **${flight.number}** posted and registered in database! ${reminderNote}`);

        } catch (error) {
            console.error('❌ Error executing /postflight:', error);
            await interaction.editReply('❌ Failed to save and post the flight allocation sheet.');
        }
    },
};