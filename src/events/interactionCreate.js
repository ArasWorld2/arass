const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons } = require('../utils/embeds');

async function sendLog(client, guildId, channelId, messageId, { action, userId, role, flightNumber }) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;
  try {
    const channel = await client.channels.fetch(logChannelId);
    await channel.send(`✈️ **${flightNumber}** • ${role}\n👤 <@${userId}> — ${action}\n🔗 [View Flight](https://discord.com/channels/${guildId}/${channelId}/${messageId})`);
  } catch (err) {
    console.warn('Could not send log:', err.message);
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Slash commands ──────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const msg = { content: '❌ An error occurred.', ephemeral: true };
        interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
      }
      return;
    }

    // ── Dropdown / Select Menu ──────────────────────────────────────
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'role_select') return;

    await interaction.deferUpdate();

    const value = interaction.values[0]; // e.g. "join_captain"
    const roleKey = value.replace('join_', '');
    const roleConfig = getRoleConfig(roleKey);
    if (!roleConfig) return;

    const userId    = interaction.user.id;
    const messageId = interaction.message.id;

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) {
      return interaction.followUp({ content: '❌ Allocation not found.', ephemeral: true });
    }

    const filled = allocation[roleKey] || [];
    const queue  = allocation.queues[roleKey] || [];

    // Toggle off if already in filled
    if (filled.includes(userId)) {
      allocation[roleKey] = filled.filter(id => id !== userId);
      if (roleConfig.linkedRole) {
        allocation[roleConfig.linkedRole] = (allocation[roleConfig.linkedRole] || []).filter(id => id !== userId);
      }
      if (queue.length > 0) {
        const promoted = queue.shift();
        allocation[roleKey].push(promoted);
        allocation.queues[roleKey] = queue;
        if (roleConfig.linkedRole) allocation[roleConfig.linkedRole] = [promoted];
      }
      await allocation.save();
      await refreshMessage(interaction, allocation);
      await sendLog(client, interaction.guildId, allocation.channelId, messageId, { action: '🔴 Left', userId, role: roleConfig.label, flightNumber: allocation.flight.number });
      return interaction.followUp({ content: `✅ You left **${roleConfig.label}**.`, ephemeral: true });
    }

    // Toggle off if already in queue
    if (queue.includes(userId)) {
      allocation.queues[roleKey] = queue.filter(id => id !== userId);
      await allocation.save();
      await refreshMessage(interaction, allocation);
      await sendLog(client, interaction.guildId, allocation.channelId, messageId, { action: '🟡 Left queue', userId, role: roleConfig.label, flightNumber: allocation.flight.number });
      return interaction.followUp({ content: `✅ You removed yourself from the **${roleConfig.label}** queue.`, ephemeral: true });
    }

    // Join filled or queue
    if (filled.length < roleConfig.max) {
      allocation[roleKey].push(userId);
      if (roleConfig.linkedRole) {
        const linked = allocation[roleConfig.linkedRole] || [];
        if (!linked.includes(userId)) allocation[roleConfig.linkedRole] = [userId];
      }
      await allocation.save();
      await refreshMessage(interaction, allocation);
      await sendLog(client, interaction.guildId, allocation.channelId, messageId, { action: '🟢 Joined', userId, role: roleConfig.label, flightNumber: allocation.flight.number });
      const linkedMsg = roleConfig.linkedRole ? ` You have also been assigned as **Flight Dispatcher**.` : '';
      return interaction.followUp({ content: `✅ You joined **${roleConfig.label}**.${linkedMsg}`, ephemeral: true });
    } else {
      allocation.queues[roleKey].push(userId);
      await allocation.save();
      await refreshMessage(interaction, allocation);
      await sendLog(client, interaction.guildId, allocation.channelId, messageId, { action: '🟡 Joined queue', userId, role: roleConfig.label, flightNumber: allocation.flight.number });
      return interaction.followUp({ content: `⏳ **${roleConfig.label}** is full. You're in the queue (#${allocation.queues[roleKey].length}).`, ephemeral: true });
    }
  },
};

async function refreshMessage(interaction, allocation) {
  const embed   = buildMainEmbed(allocation.flight, allocation);
  const buttons = buildButtons();
  await interaction.message.edit({ embeds: [embed], components: buttons });
}
