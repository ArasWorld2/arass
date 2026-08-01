const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeflight')
    .setDescription('Deletes a flight allocation from MongoDB and removes its Discord messages/channels')
    .addStringOption(o => 
      o.setName('flight_number')
        .setDescription('Select or search for the flight number to remove')
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
          name: `${flightNum} (${from} -> ${to} | ${date})`,
          value: a.messageId
        };
      });

      await interaction.respond(choices).catch(() => {});
    } catch (err) {
      console.error('Autocomplete error in removeflight:', err);
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('flight_number');

    // 1. Fetch flight record from MongoDB
    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Flight allocation not found in database.');
    }

    const flightNum = allocation.flight?.number || 'Flight';

    // 2. Delete FD Pool selection message if it exists
    if (allocation.fdChoiceMessageId) {
      try {
        const fdChannelId = process.env.FLIGHT_DECK_CHANNEL_ID || allocation.channelId;
        const fdChannel = await interaction.client.channels.fetch(fdChannelId);
        const fdMsg = await fdChannel.messages.fetch(allocation.fdChoiceMessageId);
        await fdMsg.delete();
      } catch (err) {
        console.warn('Could not delete FD pool message:', err.message);
      }
    }

    // 3. Delete Main Flight Sheet message
    try {
      const flightChannel = await interaction.client.channels.fetch(allocation.channelId);
      const mainMsg = await flightChannel.messages.fetch(allocation.messageId);
      await mainMsg.delete();
    } catch (err) {
      console.warn('Could not delete main flight message sheet:', err.message);
    }

    // 4. Remove from MongoDB
    await Allocation.deleteOne({ messageId });

    return interaction.editReply(`🗑️ Successfully deleted flight **${flightNum}** and removed its records from MongoDB!`);
  },
};