const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editflight')
    .setDescription('Edit an existing flight allocation post')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the flight post').setRequired(true))
    .addStringOption(o => o.setName('number').setDescription('New flight number').setRequired(false))
    .addStringOption(o => o.setName('from').setDescription('New departure airport').setRequired(false))
    .addStringOption(o => o.setName('to').setDescription('New arrival airport').setRequired(false))
    .addStringOption(o => o.setName('aircraft').setDescription('New aircraft type').setRequired(false))
    .addStringOption(o => o.setName('staff_time').setDescription('New personnel join time').setRequired(false))
    .addStringOption(o => o.setName('passenger_time').setDescription('New passenger joining time').setRequired(false))
    .addStringOption(o => o.setName('gate').setDescription('New gate').setRequired(false))
    .addStringOption(o => o.setName('boarding_time').setDescription('New boarding time').setRequired(false))
    .addStringOption(o => o.setName('date').setDescription('New date').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');
    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) return interaction.editReply('❌ Flight allocation not found.');

    // Update only fields that were provided
    const fields = ['number', 'from', 'to', 'aircraft', 'gate', 'date'];
    for (const field of fields) {
      const val = interaction.options.getString(field);
      if (val) allocation.flight[field] = field === 'number' ? val.toUpperCase() : val;
    }
    if (interaction.options.getString('staff_time'))     allocation.flight.staffTime = interaction.options.getString('staff_time');
    if (interaction.options.getString('passenger_time')) allocation.flight.passengerTime = interaction.options.getString('passenger_time');
    if (interaction.options.getString('boarding_time'))  allocation.flight.boardingTime = interaction.options.getString('boarding_time');

    allocation.markModified('flight');
    await allocation.save();

    // Refresh the message
    try {
      const channel = await interaction.client.channels.fetch(allocation.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.edit({
        embeds: [buildMainEmbed(allocation.flight, allocation)],
        components: buildButtons(),
      });
    } catch (err) {
      return interaction.editReply('❌ Could not find the original message. Was it deleted?');
    }

    await interaction.editReply('✅ Flight updated successfully!');
  },
};
