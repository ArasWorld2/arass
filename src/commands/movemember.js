const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('movemember')
    .setDescription('Admin: Move a user from one role to another')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the flight allocation').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User to move').setRequired(true))
    .addStringOption(o => {
      const opt = o.setName('from_role').setDescription('Role to move them FROM').setRequired(true);
      ROLES.filter(r => !r.autoFilled).forEach(r => opt.addChoices({ name: r.label, value: r.key }));
      return opt;
    })
    .addStringOption(o => {
      const opt = o.setName('to_role').setDescription('Role to move them TO').setRequired(true);
      ROLES.filter(r => !r.autoFilled).forEach(r => opt.addChoices({ name: r.label, value: r.key }));
      return opt;
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const messageId  = interaction.options.getString('message_id');
    const user       = interaction.options.getUser('user');
    const fromKey    = interaction.options.getString('from_role');
    const toKey      = interaction.options.getString('to_role');

    if (fromKey === toKey) {
      return interaction.editReply('❌ From and To roles must be different.');
    }

    const fromConfig = getRoleConfig(fromKey);
    const toConfig   = getRoleConfig(toKey);

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) return interaction.editReply('❌ Allocation not found.');

    const fromFilled = allocation[fromKey] || [];
    const toFilled   = allocation[toKey]   || [];

    // Check user is in the from role
    if (!fromFilled.includes(user.id)) {
      return interaction.editReply(`❌ <@${user.id}> is not in **${fromConfig.label}**.`);
    }

    // Check to role has space
    if (toFilled.length >= toConfig.max) {
      return interaction.editReply(`❌ **${toConfig.label}** is full (${toFilled.length}/${toConfig.max}). Use /unallocate first to free a slot.`);
    }

    // Remove from old role
    allocation[fromKey] = fromFilled.filter(id => id !== user.id);

    // Remove linked role if applicable
    if (fromConfig.linkedRole) {
      allocation[fromConfig.linkedRole] = (allocation[fromConfig.linkedRole] || []).filter(id => id !== user.id);
    }

    // Promote from queue in old role if any
    const fromQueue = allocation.queues?.[fromKey] || [];
    if (fromQueue.length > 0) {
      const promoted = fromQueue.shift();
      allocation[fromKey].push(promoted);
      allocation.queues[fromKey] = fromQueue;
      if (fromConfig.linkedRole) allocation[fromConfig.linkedRole] = [promoted];
    }

    // Add to new role
    allocation[toKey].push(user.id);

    // Auto-fill linked role in new role if applicable
    if (toConfig.linkedRole) {
      allocation[toConfig.linkedRole] = [user.id];
    }

    await allocation.save();

    // Refresh message
    try {
      const channel = await interaction.client.channels.fetch(allocation.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.edit({ embeds: [buildMainEmbed(allocation.flight, allocation)], components: buildButtons() });
    } catch {}

    // Log
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (logChannelId) {
      try {
        const logChannel = await interaction.client.channels.fetch(logChannelId);
        await logChannel.send(`🔀 Moved | **Flight ${allocation.flight.number}** | <@${user.id}> moved from **${fromConfig.label}** → **${toConfig.label}** | By: <@${interaction.user.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${allocation.channelId}/${messageId})`);
      } catch {}
    }

    return interaction.editReply(`✅ Moved <@${user.id}> from **${fromConfig.label}** to **${toConfig.label}**.`);
  },
};
