const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons } = require('../utils/embeds');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('choosefd')
    .setDescription('Randomly select Captain and/or First Officer from the entry pool')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the main flight allocation').setRequired(true))
    .addStringOption(o => 
      o.setName('role')
        .setDescription('Role to select for')
        .setRequired(true)
        .addChoices(
          { name: 'Captain (CPT)', value: 'cpt' },
          { name: 'First Officer (FO)', value: 'fo' },
          { name: 'Both Roles', value: 'both' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('message_id');
    const roleChoice = interaction.options.getString('role');

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Allocation not found for that Message ID.');
    }

    const cptPool = allocation.cptPool || [];
    const foPool  = allocation.foPool  || [];

    const results = [];

    // Select Captain
    if (roleChoice === 'cpt' || roleChoice === 'both') {
      if (cptPool.length === 0) {
        results.push('⚠️ No candidates found in the **Captain** pool.');
      } else {
        const selectedCpt = cptPool[Math.floor(Math.random() * cptPool.length)];
        if (!allocation.cpt) allocation.cpt = [];
        allocation.cpt = [selectedCpt];
        results.push(`🎉 Selected **Captain**: <@${selectedCpt}>`);
      }
    }

    // Select First Officer
    if (roleChoice === 'fo' || roleChoice === 'both') {
      if (foPool.length === 0) {
        results.push('⚠️ No candidates found in the **First Officer** pool.');
      } else {
        const selectedFo = foPool[Math.floor(Math.random() * foPool.length)];
        if (!allocation.fo) allocation.fo = [];
        allocation.fo = [selectedFo];
        results.push(`🎉 Selected **First Officer**: <@${selectedFo}>`);
      }
    }

    await allocation.save();

    // Update main flight embed sheet
    try {
      const channel = await interaction.client.channels.fetch(allocation.channelId);
      const mainMessage = await channel.messages.fetch(messageId);
      await mainMessage.edit({
        embeds: [buildMainEmbed(allocation.flight, allocation)],
        components: buildButtons()
      });

      // Send announcement in flight channel
      await channel.send(
        `🎲 **Flight Deck Lottery Results for ${allocation.flight.number}!**\n` +
        results.join('\n')
      );
    } catch (err) {
      console.error('Failed to update main flight message after choosefd:', err);
    }

    return interaction.editReply(`✅ Processed Flight Deck lottery!\n\n${results.join('\n')}`);
  },
};