const Allocation = require('../models/Allocation');
const { getRoleConfig, buildFlightEmbed, buildAllocationEmbed, buildButtons } = require('../utils/embeds');

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

    // ── Button interactions ─────────────────────────────────────────
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('join_')) return;

    await interaction.deferUpdate();

    const roleKey = interaction.customId.replace('join_', '');
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

    // Already in filled slots
    if (filled.includes(userId)) {
      // Toggle off — leave the role
      allocation[roleKey] = filled.filter(id => id !== userId);

      // Promote first in queue if any
      if (queue.length > 0) {
        const promoted = queue.shift();
        allocation[roleKey].push(promoted);
        allocation.queues[roleKey] = queue;
      }

      await allocation.save();
      await refreshMessage(interaction, allocation);
      return interaction.followUp({ content: `✅ You left **${roleConfig.label}**.`, ephemeral: true });
    }

    // Already in queue
    if (queue.includes(userId)) {
      allocation.queues[roleKey] = queue.filter(id => id !== userId);
      await allocation.save();
      await refreshMessage(interaction, allocation);
      return interaction.followUp({ content: `✅ You removed yourself from the **${roleConfig.label}** queue.`, ephemeral: true });
    }

    // Join filled slot or queue
    if (filled.length < roleConfig.max) {
      allocation[roleKey].push(userId);
      await allocation.save();
      await refreshMessage(interaction, allocation);
      return interaction.followUp({ content: `✅ You joined **${roleConfig.label}**.`, ephemeral: true });
    } else {
      allocation.queues[roleKey].push(userId);
      await allocation.save();
      await refreshMessage(interaction, allocation);
      return interaction.followUp({ content: `⏳ **${roleConfig.label}** is full. You've been added to the queue (#${allocation.queues[roleKey].length}).`, ephemeral: true });
    }
  },
};

async function refreshMessage(interaction, allocation) {
  const flightEmbed     = buildFlightEmbed(allocation.flight);
  const allocationEmbed = buildAllocationEmbed(allocation);
  const buttons         = buildButtons();

  await interaction.message.edit({
    embeds: [flightEmbed, allocationEmbed],
    components: buttons,
  });
}
