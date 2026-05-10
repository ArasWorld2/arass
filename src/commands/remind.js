const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Send a DM reminder to all allocated staff on a flight')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the flight allocation').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Custom message to include (optional)').setRequired(false)),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const messageId    = interaction.options.getString('message_id');
    const customMsg    = interaction.options.getString('message') || null;

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) return interaction.editReply('❌ Flight allocation not found.');

    const flight = allocation.flight;

    // Collect all allocated user IDs
    const allUserIds = new Set([
      ...allocation.dispatchSupervisor,
      ...allocation.flightSupervisor,
      ...allocation.captain,
      ...allocation.firstOfficer,
      ...allocation.purser,
      ...allocation.cabinCrew,
      ...allocation.groundHandling,
      ...allocation.tarmacSupervisor,
      ...allocation.dispatchCoordinator,
    ]);

    if (allUserIds.size === 0) {
      return interaction.editReply('❌ No staff allocated to this flight yet.');
    }

    const embed = new EmbedBuilder()
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('✈️ Flight Reminder')
      .setDescription(`You have been reminded about your upcoming flight assignment.`)
      .addFields(
        { name: 'Flight', value: `**${flight.number}**`, inline: true },
        { name: 'Route', value: `${flight.from} → ${flight.to}`, inline: true },
        { name: 'Aircraft', value: flight.aircraft || 'TBA', inline: true },
        { name: 'Personnel Join Time', value: flight.staffTime || 'TBA', inline: true },
        { name: 'Passenger Joining Time', value: flight.passengerTime || 'TBA', inline: true },
        { name: 'Gate', value: flight.gate || 'TBA', inline: true },
      )
      .setFooter({ text: 'Wizz Air Virtual Operations' })
      .setTimestamp();

    if (customMsg) {
      embed.addFields({ name: '📢 Message from Operations', value: customMsg });
    }

    let sent = 0;
    let failed = 0;

    for (const userId of allUserIds) {
      try {
        const user = await interaction.client.users.fetch(userId);
        await user.send({ embeds: [embed] });
        sent++;
      } catch {
        failed++;
      }
    }

    // Log it
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (logChannelId) {
      try {
        const logChannel = await interaction.client.channels.fetch(logChannelId);
        await logChannel.send(`📢 Reminder sent | **Flight ${flight.number}** | By: <@${interaction.user.id}> | Sent: ${sent} | Failed: ${failed}`);
      } catch {}
    }

    await interaction.editReply(`✅ Reminder sent to **${sent}** staff member(s)${failed > 0 ? ` (${failed} failed — they may have DMs disabled)` : ''}.`);
  },
};
