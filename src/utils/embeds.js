const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Changed from WIZZ_PURPLE to DOLOMITI_TURQUOISE
const DOLOMITI_TURQUOISE = '#9b06b9'; 

const ROLES = [
  { key: 'dispatchSupervisor',  label: 'Flight Dispatcher',     emoji: '<:WP_person:1503497022211227850>', max: 1 },
  { key: 'flightSupervisor',    label: 'Flight Supervisor',      emoji: '<:WP_person:1503497022211227850>', max: 2 },
  { key: 'captain',             label: 'Captain',                emoji: '<:WP_man:1503497042071257249>',    max: 1 },
  { key: 'firstOfficer',        label: 'First Officer',          emoji: '<:WP_link:1503497040406253769>',   max: 1 },
  { key: 'purser',              label: 'Senior Cabin Attendant', emoji: '<:WP_telephone:1503497077588496614>', max: 1 },
  { key: 'cabinCrew',           label: 'Cabin Crew',             emoji: '<:WP_people:1503497020311343234>', max: 4 },
  { key: 'groundHandling',      label: 'Turnaround Manager',     emoji: '<:WP_helpdesk:1503497171243110440>', max: 1 },
  { key: 'tarmacSupervisor',    label: 'Ground Crew',            emoji: '<:WP_passenger:1503497017295376514>', max: 3 },
  { key: 'dispatchCoordinator', label: 'Customer Service',       emoji: '<:WP_share:1503497105908437032>',  max: 3 },
  { key: 'bagDropAgent',        label: 'Bag Drop Agent',         emoji: '<:WP_share:1503497105908437032>', max: 3 },
  { key: 'gateAgent',           label: 'Gate Agent',             emoji: '<:WP_helpdesk:1503497171243110440>', max: 1 },
  { key: 'loungeAttendant',     label: 'Lounge Attendant',       emoji: '<:WP_link:1503497040406253769>', max: 2 },
];

const FLIGHT_ROLE_KEYS = ['dispatchSupervisor', 'flightSupervisor', 'captain', 'firstOfficer', 'purser', 'cabinCrew', 'groundHandling', 'tarmacSupervisor'];
const GROUND_ROLE_KEYS = ['dispatchCoordinator', 'bagDropAgent', 'gateAgent', 'loungeAttendant'];

function getRoleConfig(key) {
  return ROLES.find(r => r.key === key);
}

function buildRoleLines(keys, allocation) {
  return keys.map(key => {
    const role = ROLES.find(r => r.key === key);
    if (!role) return '';
    const filled = (allocation && allocation[role.key]) || [];
    const count = `(${filled.length}/${role.max})`;
    const members = filled.length > 0 ? ' ' + filled.map(id => `<@${id}>`).join(', ') : '';
    return `${role.emoji} **${role.label}** ${count}${members}`;
  }).filter(Boolean).join('\n');
}

function buildMainEmbed(flight, allocation) {
  const infoLines = [
    ` **Route:** ${flight.from || 'TBD'} → ${flight.to || 'TBD'}`,
    ` **Plane:** ${flight.aircraft || 'TBD'}`,
    ` **Gate:** ${flight.gate || 'TBA'}`,
    ` **Personnel Join Time:** ${flight.staffTime || 'TBA'} | **Passenger Joining Time:** ${flight.passengerTime || 'TBA'}`,
    ` **Boarding Time:** ${flight.boardingTime || 'TBA'}`,
    ` **Operations Closure:** ${flight.operationsClosure || 'TBA'}`,
  ].join('\n');

  const flightRoleLines = buildRoleLines(FLIGHT_ROLE_KEYS, allocation);
  const groundRoleLines = buildRoleLines(GROUND_ROLE_KEYS, allocation);

  return new EmbedBuilder()
    .setColor(DOLOMITI_TURQUOISE) // Updated color variable
    .setAuthor({ 
      name: 'Wizz Air — Flight Operations', // Updated company name
      iconURL: 'data:image/png;base64,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' // Updated logo
    })
    .addFields([
      {
        name: '<:WP_takeoff:1503497120760729771> Flight Briefing',
        value: `__**${flight.number || 'N/A'}**__ • ${flight.date || new Date().toDateString()}`,
      },
      {
        name: '\u200B',
        value: `A new **Wizz Air** Briefing has been published. **Ensure to** read all **information** contained within this message. **Be reminded** flight info is subject to alter. In order to allocate, interact with the dropdown below.`, // Updated reference text
      },
      {
        name: '\u200B',
        value: infoLines || '\u200B',
      },
      {
        name: 'Flight Roles',
        value: flightRoleLines || '\u200B',
      },
      {
        name: 'Ground Roles',
        value: groundRoleLines || '\u200B',
      }
    ])
    .setFooter({ text: 'Air Dolomiti Flight Operations • Select a role below to allocate' }) // Updated footer
    .setTimestamp();
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