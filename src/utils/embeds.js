const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Role definitions: key, label, emoji, max slots
const ROLES = [
  { key: 'captain',             label: 'Captain',               emoji: '🧑‍✈️', max: 1 },
  { key: 'firstOfficer',        label: 'First Officer',         emoji: '✈️',   max: 1 },
  { key: 'purser',              label: 'Cabin Purser',          emoji: '🎫',   max: 1 },
  { key: 'cabinCrew',           label: 'Cabin Crew',            emoji: '👤',   max: 4 },
  { key: 'groundHandling',      label: 'Tarmac Manager',        emoji: '🔵',   max: 1 },
  { key: 'tarmacSupervisor',    label: 'Tarmac Agent',          emoji: '⚠️',   max: 3 },
  { key: 'dispatchCoordinator', label: 'Customer Assistance',   emoji: '🎯',   max: 3 },
  { key: 'dispatchSupervisor',  label: 'Operations Controller', emoji: '🎖️',   max: 1 },
];

function getRoleConfig(key) {
  return ROLES.find(r => r.key === key);
}

function buildMainEmbed(flight, allocation) {
  const roleLines = ROLES.map(role => {
    const filled = (allocation && allocation[role.key]) || [];
    const count = `(${filled.length}/${role.max})`;
    const members = filled.length > 0 ? ' ' + filled.map(id => `<@${id}>`).join(', ') : '';
    return `${role.emoji} **${role.label}** ${count}${members}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0x1a1a2e)
    .addFields(
      {
        name: '**DEPARTURE DUTY**\nجدول المغادرة',
        value: `${flight.date || 'Today'} ✦ ${flight.number}`,
      },
      {
        name: '\u200B',
        value: `Regard the newest ✈️ **${flight.airline || 'Flight Operations'}** duty briefing. **Ensure to** acknowledge all **information** contained within this message. **Be reminded** this is subject to alter. In order to allocate, interact with the message additions below.`,
      },
      {
        name: '\u200B',
        value: [
          `🌍 **${flight.from} - ${flight.to}**`,
          `✈️ ${flight.aircraft}`,
          `👤 Operations Controller: ${flight.controller ? `<@${flight.controller}>` : 'TBA'}`,
          `🔵 Duty Report: ${flight.staffTime} | Passenger Report: ${flight.passengerTime}`,
        ].join('\n'),
      },
      {
        name: '**ASSIGNMENT SELECTION**\nاختيار المهمة',
        value: roleLines,
      }
    );
}

function buildDropdown() {
  const options = ROLES.map(role =>
    new StringSelectMenuOptionBuilder()
      .setLabel(role.label)
      .setValue(`join_${role.key}`)
      .setDescription(`Join or leave ${role.label} (max ${role.max})`)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('role_select')
    .setPlaceholder('Select a role to allocate or unallocate yourself')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

function buildButtons() {
  return [buildDropdown()];
}

module.exports = { ROLES, getRoleConfig, buildFlightEmbed: buildMainEmbed, buildAllocationEmbed: buildMainEmbed, buildMainEmbed, buildButtons, buildDropdown };
