const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Allocation = require('../models/Allocation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeflight')
    .setDescription('Remove a flight allocation (admins only)')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the allocation to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.options.getString('message_id');

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ No allocation found with that message ID.');
    }

    try {
      const channel = await interaction.client.channels.fetch(allocation.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.delete();
    } catch {
      // Message already deleted or not found — still clean DB
    }

    await Allocation.deleteOne({ messageId });
    await interaction.editReply('✅ Flight allocation removed.');
  },
};
