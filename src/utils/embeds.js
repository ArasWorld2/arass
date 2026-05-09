const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Role definitions: key, label, emoji, max slots
const ROLES = [
  { key: 'dispatchCoordinator', label: 'Dispatch Coordinator', emoji: '🎯', max: 1 },
  { key: 'dispatchSupervisor',  label: 'Dispatch Supervisor',  emoji: '🎯', max: 2 },
  { key: 'captain',             label: 'Captain',              emoji: '🛫', max: 1 },
  { key: 'firstOfficer',        label: 'First Officer',        emoji: '✈️', max: 1 },
  { key: 'cabinCrew',           label: 'Cabin Crew',           emoji: '👤', max: 6 },
  { key: 'groundHandling',      label: 'Ground Handling',      emoji: '⚠️', max: 4 },
  { key: 'purser',              label: 'Purser',               emoji: '🎫', max: 1 },
  { key: 'tarmacSupervisor',    label: 'Tarmac Supervisor',    emoji: '🔵', max: 1 },
  { key: 'customerService',    label: 'Customer Service',    emoji: '🔵', max: 1 },
];

function getRoleConfig(key) {
  return ROLES.find(r => r.key === key);
}

function buildFlightEmbed(flight) {
  return new EmbedBuilder()
    .setTitle(`✈️  ${flight.number}`)
    .addFields(
      { name: 'Departure', value: flight.from,          inline: true },
      { name: 'Arrival',   value: flight.to,            inline: true },
      { name: '\u200B',    value: '\u200B',             inline: true },
      { name: 'Staff Joining',     value: flight.staffTime },
      { name: 'Passenger Joining', value: flight.passengerTime },
      { name: 'Equipment',         value: flight.aircraft },
    )
    .setColor(0x5865F2)
    .setTimestamp();
}

function buildAllocationEmbed(allocation) {
  const fields = [];

  for (const role of ROLES) {
    const filled  = allocation[role.key] || [];
    const queue   = (allocation.queues && allocation.queues[role.key]) || [];
    const count   = `(${filled.length}/${role.max})`;

    const filledText = filled.length > 0
      ? filled.map(id => `<@${id}>`).join('\n')
      : 'N/A';

    const queueText = queue.length > 0
      ? `Queue (${queue.length}): ${queue.map(id => `<@${id}>`).join(', ')}`
      : 'Queue (0)';

    fields.push({
      name: `${role.emoji}  ${role.label} ${count}`,
      value: `${filledText}\n*${queueText}*`,
      inline: true,
    });

    // Add blank field every 2 for side-by-side layout
    if (fields.length % 3 === 2) {
      fields.push({ name: '\u200B', value: '\u200B', inline: true });
    }
  }

  return new EmbedBuilder()
    .setTitle('📋  Allocation Sheet')
    .addFields(fields)
    .setColor(0x2B2D31)
    .setFooter({ text: 'Click a button below to join a role' });
}

function buildButtons() {
  const rows = [];
  // Split 8 buttons into 2 rows of 4
  const chunks = [ROLES.slice(0, 4), ROLES.slice(4)];
  for (const chunk of chunks) {
    const row = new ActionRowBuilder();
    for (const role of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`join_${role.key}`)
          .setLabel(role.emoji)
          .setStyle(ButtonStyle.Primary)
      );
    }
    rows.push(row);
  }
  return rows;
}

module.exports = { ROLES, getRoleConfig, buildFlightEmbed, buildAllocationEmbed, buildButtons };
