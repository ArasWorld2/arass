const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Wizz Air purple: #C6007E (pink/magenta) or #8B1DB8 (purple)
const WIZZ_PURPLE = 0xC6007E;

// Role definitions
const ROLES = [
  { key: 'dispatchSupervisor', label: 'Flight Dispatcher', emoji: '<:WP_person:1392562551597961346>', max: 1 },
  { key: 'dispatchSuperviso', label: 'Flight Supervisor', emoji: '<:WP_person:1392562551597961346>', max: 1 },
  { key: 'captain',             label: 'Captain',               emoji: '<:WP_woman:1392562577405509783>', max: 1 },
  { key: 'firstOfficer',        label: 'First Officer',         emoji: '<:WP_link:1392562549144293437>',   max: 1 },
  { key: 'purser',              label: 'Senior Cabin Attendant',          emoji: '<:WP_chat:1392562630991810841>',   max: 1 },
  { key: 'cabinCrew',           label: 'Cabin Crew',            emoji: '<:WP_people:1392562569818013870>',   max: 4 },
  { key: 'groundHandling',      label: 'Turnaround Manager',        emoji: '<:WP_clock:1392562574935195739>',   max: 1 },
  { key: 'tarmacSupervisor',    label: 'Ground Crew',          emoji: '<:WP_hammer:1392562571663642755>',   max: 3 },
  { key: 'dispatchCoordinator', label: 'Customer Service',   emoji: '<:WP_link:1392562549144293437>',   max: 3 },
];

function getRoleConfig(key) {
  return ROLES.find(r => r.key === key);
}

function buildMainEmbed(flight, allocation) {
  const infoLines = [
  `🌍 **Route:** ${flight.from} → ${flight.to}`,
  `✈️ **Plane:** ${flight.aircraft}`,
  `🕐 Personnel Join Time: ${flight.staffTime} | Passenger Joining Time: ${flight.passengerTime}`,
].join('\n');

const roleLines = infoLines + '\n\u200B\n' + ROLES.map(role => {
    const filled = (allocation && allocation[role.key]) || [];
    const count = `(${filled.length}/${role.max})`;
    const members = filled.length > 0 ? ' ' + filled.map(id => `<@${id}>`).join(', ') : '';
    return `${role.emoji} **${role.label}** ${count}${members}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(WIZZ_PURPLE)
    .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
    .addFields(
      {
        name: '🛫  Flight Briefing',
        value: `__**${flight.number}**__ • ${flight.date}`,
      },
      {
        name: '\u200B',
        value: `Regard the newest ✈️ **Wizz Air** duty briefing. **Ensure to** acknowledge all **information** contained within this message. **Be reminded** this is subject to alter. In order to allocate, interact with the dropdown below.`,
      },
      {
        name: '',
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
