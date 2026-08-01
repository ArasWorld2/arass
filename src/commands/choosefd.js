const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons } = require('../utils/embeds');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('choosefd')
    .setDescription('Randomly select Captain/FO from the pool, assign them to the flight sheet, and DM them')
    .addStringOption(o => 
      o.setName('flight_number')
        .setDescription('Select or search for the flight number')
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
      console.error('Autocomplete error in choosefd:', err);
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('flight_number');

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Flight allocation not found in database.');
    }

    const flightNum = allocation.flight?.number || 'Flight';
    const cptPool = allocation.cptPool || [];
    const foPool = allocation.foPool || [];

    if (cptPool.length === 0 && foPool.length === 0) {
      return interaction.editReply(`❌ No candidates currently in the pool for **${flightNum}**.`);
    }

    let selectedCpt = null;
    let selectedFo = null;

    // Pick random Captain if available
    if (cptPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * cptPool.length);
      selectedCpt = cptPool[randomIndex];
      allocation.captain = [selectedCpt]; // Direct allocation
    }

    // Pick random First Officer if available
    if (foPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * foPool.length);
      selectedFo = foPool[randomIndex];
      allocation.firstOfficer = [selectedFo]; // Direct allocation
    }

    // Clear candidate pools
    allocation.cptPool = [];
    allocation.foPool = [];

    await allocation.save();

    // 1. Update the Main Flight Sheet Embed in Discord
    try {
      const channel = await interaction.client.channels.fetch(allocation.channelId);
      const mainMessage = await channel.messages.fetch(allocation.messageId);

      await mainMessage.edit({
        embeds: [buildMainEmbed(allocation.flight, allocation)],
        components: buildButtons()
      });
    } catch (err) {
      console.warn('Could not update main flight message sheet:', err.message);
    }

    // 2. Direct Message Captain
    if (selectedCpt) {
      try {
        const cptUser = await interaction.client.users.fetch(selectedCpt);
        await cptUser.send(
          `✈️ **Wizz Air Flight Selection Notice**\n\n` +
          `Congratulations! You have been randomly selected as **Captain (CPT)** for flight **${flightNum}**.\n` +
          `Please check the flight channel <#${allocation.channelId}> for full briefing details and duty times.`
        );
      } catch (err) {
        console.warn(`Could not DM Captain user ${selectedCpt}:`, err.message);
      }
    }

    // 3. Direct Message First Officer
    if (selectedFo) {
      try {
        const foUser = await interaction.client.users.fetch(selectedFo);
        await foUser.send(
          `✈️ **Wizz Air Flight Selection Notice**\n\n` +
          `Congratulations! You have been randomly selected as **First Officer (FO)** for flight **${flightNum}**.\n` +
          `Please check the flight channel <#${allocation.channelId}> for full briefing details and duty times.`
        );
      } catch (err) {
        console.warn(`Could not DM First Officer user ${selectedFo}:`, err.message);
      }
    }

    // 4. Ephemeral confirmation to the host
    let summary = `✅ Successfully selected pilots for **${flightNum}**, allocated them to the flight sheet, and notified them via DM!\n\n`;
    if (selectedCpt) summary += `• **Captain:** <@${selectedCpt}>\n`;
    if (selectedFo) summary += `• **First Officer:** <@${selectedFo}>\n`;

    return interaction.editReply(summary);
  },
};