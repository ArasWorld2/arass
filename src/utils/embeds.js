const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Wizz Air purple: #C6007E (pink/magenta) or #8B1DB8 (purple)
const WIZZ_PURPLE = 0xC6007E;

// Role definitions
const ROLES = [
  { key: 'captain',             label: 'Captain',               emoji: '🧑‍✈️', max: 1 },
  { key: 'firstOfficer',        label: 'First Officer',         emoji: '✈️',   max: 1 },
  { key: 'purser',              label: 'Cabin Purser',          emoji: '🎫',   max: 1 },
  { key: 'cabinCrew',           label: 'Cabin Crew',            emoji: '👤',   max: 4 },
  { key: 'groundHandling',      label: 'Tarmac Manager',        emoji: '🔵',   max: 1 },
  { key: 'tarmacSupervisor',    label: 'Tarmac Agent',          emoji: '⚠️',   max: 3 },
  { key: 'dispatchCoordinator', label: 'Customer Assistance',   emoji: '🎯',   max: 3 },
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
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(WIZZ_PURPLE)
    .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Wizz_Air_logo.svg/320px-Wizz_Air_logo.svg.png' })
    .addFields(
      {
        name: '🛫  DEPARTURE DUTY',
        value: `__**${flight.number}**__`,
      },
      {
        name: '\u200B',
        value: `Regard the newest ✈️ **Wizz Air** duty briefing. **Ensure to** acknowledge all **information** contained within this message. **Be reminded** this is subject to alter. In order to allocate, interact with the dropdown below.`,
      },
      {
        name: '\u200B',
        value: [
          `🌍 **Route:** ${flight.from}  →  ${flight.to}`,
          `✈️ **Plane:** ${flight.aircraft}`,
          `📡 **Flight Dispatcher:** ${allocation && allocation.dispatchSupervisor && allocation.dispatchSupervisor[0] ? `<@${allocation.dispatchSupervisor[0]}>` : 'TBA'}`,
          `🕐  Duty Report: ${flight.staffTime}  |  Passenger Report: ${flight.passengerTime}`,
        ].join('\n\n'),
      },
      {
        name: '📋  ASSIGNMENT SELECTION',
        value: roleLines,
      }
    )
    .setFooter({ text: 'Wizz Air Virtual Operations • Select a role below to sign up' })
    .setTimestamp();
}

function buildDropdown() {
  const options = ROLES
    .filter(role => !role.autoFilled)
    .map(role =>
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
