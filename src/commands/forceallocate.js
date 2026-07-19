const { checkRole } = require('../utils/checkRole');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Allocation = require('../models/Allocation');
const { getRoleConfig, buildMainEmbed, buildButtons, ROLES } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forceallocate')
    .setDescription('Admin: Forcefully allocate a user to a role or queue on a flight')
    .addStringOption(o => o.setName('message_id').setDescription('Message ID of the flight allocation').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User to allocate').setRequired(true))
    .addStringOption(o => {
      const opt = o.setName('role').setDescription('Role to assign them to').setRequired(true);
      ROLES.filter(r => !r.autoFilled).forEach(r => opt.addChoices({ name: r.label, value: r.key }));
      return opt;
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!await checkRole(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message_id');
    const user      = interaction.options.getUser('user');
    const roleKey   = interaction.options.getString('role');
    const roleConfig = getRoleConfig(roleKey);
    const maxSlots  = roleConfig?.max || 1;

    const allocation = await Allocation.findOne({ messageId });
    if (!allocation) return interaction.editReply('❌ Allocation sheet not found.');

    if (!allocation[roleKey]) allocation[roleKey] = [];
    if (!allocation.queues) allocation.queues = {};
    if (!allocation.queues[roleKey]) allocation.queues[roleKey] = [];

    // Check if they are already in this role active slot
    if (allocation[roleKey].includes(user.id)) {
      return interaction.editReply(`⚠️ <@${user.id}> is already allocated to **${roleConfig.label}**.`);
    }

    // Check if they are already waiting inside the queue
    if (allocation.queues[roleKey].includes(user.id)) {
      return interaction.editReply(`⚠️ <@${user.id}> is already in the queue for **${roleConfig.label}**.`);
    }

    let joinedQueue = false;

    // SLOT VERIFICATION CHECK
    if (allocation[roleKey].length < maxSlots) {
      allocation[roleKey].push(user.id);
    } else {
      allocation.queues[roleKey].push(user.id);
      joinedQueue = true;
    }

    await allocation.save();

    // Refresh the flight sheet message
    try {
      const channel = await interaction.client.channels.fetch(allocation.channelId);
      const message = await channel.messages.fetch(messageId);
      await message.edit({ 
        embeds: [buildMainEmbed(allocation.flight, allocation)], 
        components: buildButtons() 
      });
    } catch (err) {
      console.warn('Could not refresh embed message:', err.message);
    }

    // Send the log to your logging channel
    await sendLog(interaction, {
      action: joinedQueue ? '⏳ Force Queue Joined' : '🟢 Force Allocated',
      admin: interaction.user,
      target: user,
      role: roleConfig.label,
      flightNumber: allocation.flight?.number || 'Unknown',
      messageId,
    });

    if (joinedQueue) {
      return interaction.editReply(`⏳ Slot full! Forcefully added <@${user.id}> to the queue for **${roleConfig.label}**.`);
    } else {
      return interaction.editReply(`✅ Forcefully allocated <@${user.id}> as **${roleConfig.label}**!`);
    }
  },
};

async function sendLog(interaction, { action, admin, target, role, flightNumber, messageId }) {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  if (!logChannelId) return;
  try {
    const channel = await interaction.client.channels.fetch(logChannelId);
    await channel.send(`${action} | **Flight ${flightNumber}** | **${role}** | User: <@${target.id}> | By: <@${admin.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId})`);
  } catch (err) {
    console.warn('Could not send force allocate log:', err.message);
  }
}