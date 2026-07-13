const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Changed from WIZZ_PURPLE to DOLOMITI_TURQUOISE
const DOLOMITI_TURQUOISE = '#d3007f'; 

const ROLES = [
  { key: 'dispatchSupervisor',  label: 'Flight Dispatcher',     emoji: '<:WP_person:1513933547474522264>', max: 1 },
  { key: 'flightSupervisor',    label: 'Flight Supervisor',      emoji: '<:WP_person:1513933547474522264>', max: 2 },
  { key: 'captain',             label: 'Captain',                emoji: '<:WP_man:1513933680563982356>',    max: 1 },
  { key: 'firstOfficer',        label: 'First Officer',          emoji: '<:WP_link:1513933564255670383>',   max: 1 },
  { key: 'purser',              label: 'Senior Cabin Attendant', emoji: '<:WP_telephone:1513933092811964557>', max: 1 },
  { key: 'cabinCrew',           label: 'Cabin Crew',             emoji: '<:WP_people:1513933609776451604>', max: 4 },
  { key: 'groundHandling',      label: 'Turnaround Manager',     emoji: '<:WP_helpdesk:1513933829398855740>', max: 1 },
  { key: 'tarmacSupervisor',    label: 'Ground Crew',            emoji: '<:WP_passenger:1513933646371754034>', max: 3 },
  { key: 'dispatchCoordinator', label: 'Customer Service',       emoji: '<:WP_share:1513933370046808174>',  max: 3 },
  { key: 'bagDropAgent',        label: 'Bag Drop Agent',         emoji: '<:WP_share:1513933370046808174>', max: 3 },
  { key: 'gateAgent',           label: 'Gate Agent',             emoji: '<:WP_helpdesk:1513933829398855740>', max: 1 },
  { key: 'loungeAttendant',     label: 'Lounge Attendant',       emoji: '<:WP_link:1513933564255670383>', max: 2 },
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
      iconURL: 'https://images.seeklogo.com/logo-png/32/1/wizz-air-logo-png_seeklogo-320670.png' // Updated logo
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
    .setFooter({ text: 'Wizz Air Flight Operations • Select a role below to allocate' }) // Updated footer
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