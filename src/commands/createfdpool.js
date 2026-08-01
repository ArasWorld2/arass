const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const Allocation = require('../models/Allocation');
const { buildMainEmbed, buildButtons } = require('../utils/embeds');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createfdpool')
    .setDescription('Unallocates current FD pilots and re-creates a detailed Flight Deck pool card')
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

      const allocations = await Allocation.find(query).sort({ createdAt: -1 }).limit(10);

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

      await interaction.respond(choices);
    } catch (err) {
      console.error('Autocomplete error in createfdpool:', err);
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const messageId = interaction.options.getString('flight_number');

    // Fetch allocation document
    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.editReply('❌ Flight allocation not found in database.');
    }

    // 1. Delete old pool card message if it exists
    if (allocation.fdChoiceMessageId) {
      try {
        const fdChannelId = process.env.FLIGHT_DECK_CHANNEL_ID || allocation.channelId;
        const fdChannel = await interaction.client.channels.fetch(fdChannelId);
        const oldMsg = await fdChannel.messages.fetch(allocation.fdChoiceMessageId);
        await oldMsg.delete();
      } catch (err) {
        console.warn('Could not delete previous FD pool message:', err.message);
      }
    }

    // 2. Clear current assigned pilots and reset candidate pools
    allocation.captain = [];
    allocation.firstOfficer = [];
    allocation.cptPool = [];
    allocation.foPool = [];

    // Extract flight parameters safely
    const flightNum = allocation.flight?.number || 'Flight';
    const dep = allocation.flight?.from || 'TBD';
    const arr = allocation.flight?.to || 'TBD';
    const depTime = allocation.flight?.staffTime || allocation.flight?.time || 'TBD';
    const date = allocation.flight?.date || 'Today';
    const aircraft = allocation.flight?.aircraft || 'A320neo';

    // 3. Build Detailed Flight Deck Pool Embed Card
    const fdEmbed = new EmbedBuilder()
      .setColor('#D3007F')
      .setTitle(`Flight Deck Allocation Pool — ${flightNum}`)
      .setDescription(
        `Click below to register as **Captain** or **First Officer** for flight **${flightNum}**.\n` +
        `A host will run \`/choosefd\` to randomly select assigned pilots from this pool.\n\n` +
        `### Flight Details\n` +
        `• **Route:** \`${dep}\` ➔ \`${arr}\`\n` +
        `• **Departure Time:** \`${depTime}\` | **Date:** \`${date}\`\n` +
        `• **Aircraft:** \`${aircraft}\`\n\n` +
        `### Active Pool Candidates\n` +
        `• **Captain Candidates:** 0\n` +
        `• **First Officer Candidates:** 0`
      )
      .setFooter({ text: 'Wizz Air Flight Operations • Flight Deck Selection' })
      .setTimestamp();

    const fdRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`fd_apply_cpt_${allocation.messageId}`)
        .setLabel('Apply Captain (CPT)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`fd_apply_fo_${allocation.messageId}`)
        .setLabel('Apply First Officer (FO)')
        .setStyle(ButtonStyle.Secondary)
    );

    // 4. Post the card into FLIGHT_DECK_CHANNEL_ID (#fd-pool)
    let fdMessage;
    const fdChannelId = process.env.FLIGHT_DECK_CHANNEL_ID;

    try {
      const channelTarget = fdChannelId 
        ? await interaction.client.channels.fetch(fdChannelId) 
        : await interaction.client.channels.fetch(allocation.channelId);

      fdMessage = await channelTarget.send({ embeds: [fdEmbed], components: [fdRow] });
      allocation.fdChoiceMessageId = fdMessage.id;
    } catch (err) {
      console.error('Failed to post FD pool card:', err);
      return interaction.editReply(`❌ Could not post Flight Deck pool embed: \`${err.message}\``);
    }

    // Save cleared state and new FD card reference
    await allocation.save();

    // 5. Re-render the main flight allocation embed sheet in Discord
    try {
      const flightChannel = await interaction.client.channels.fetch(allocation.channelId);
      const mainMessage = await flightChannel.messages.fetch(allocation.messageId);

      await mainMessage.edit({
        embeds: [buildMainEmbed(allocation.flight, allocation)],
        components: buildButtons()
      });
    } catch (err) {
      console.warn('Could not update main flight message sheet:', err.message);
    }

    return interaction.editReply(`✅ Created Flight Deck pool card for **${flightNum}** (\`${dep}\` ➔ \`${arr}\`)!`);
  },
};