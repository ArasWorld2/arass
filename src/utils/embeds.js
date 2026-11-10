const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

// Custom Discord Emojis
const EMOJIS = {
    TAIL: '<:LOTTail:1520114549490057226>',
    ARROW: '<:LOTSArrow:1520114515318935584>',
    DOT: '<:Dot:1243911986115248138>'
};

const ROLES = [
    { key: 'dc', label: 'Departure Coordinator', max: 1, autoFilled: false },
    { key: 'mb', label: 'Management Board', max: 10, autoFilled: false },
    { key: 'cpt', label: 'Captain', max: 1, autoFilled: false },
    { key: 'fo', label: 'First Officer', max: 1, autoFilled: false },
    { key: 'stbyFd', label: 'Stand-by Flight Deck', max: 10, autoFilled: false },
    { key: 'purser', label: 'Purser', max: 1, autoFilled: false },
    { key: 'cc', label: 'Cabin Crew', max: 3, autoFilled: false },
    { key: 'stbyCc', label: 'Stand-by Cabin Crew', max: 10, autoFilled: false },
    { key: 'ts', label: 'Tarmac Supervisor', max: 1, autoFilled: false },
    { key: 'gc', label: 'Ground Crew', max: 3, autoFilled: false },
    { key: 'stbyGc', label: 'Stand-by Ground Crew', max: 10, autoFilled: false },
    { key: 'bcbd', label: 'Business Class Bag Drop', max: 1, autoFilled: false },
    { key: 'ecbd', label: 'Economy Class Bag Drop', max: 3, autoFilled: false },
    { key: 'cs', label: 'Customer Service', max: 2, autoFilled: false },
    { key: 'gate', label: 'Gate Agent', max: 1, autoFilled: false },
];

function getRoleConfig(key) {
    return ROLES.find(r => r.key === key) || { key, label: key, max: 1 };
}

// Safely extract array of user IDs regardless of short-key or long schema property naming
function getAssignedUsers(allocations = {}, ...keys) {
    for (const key of keys) {
        const val = allocations[key];
        if (Array.isArray(val) && val.length > 0) return val;
        if (typeof val === 'string' && val.trim().length > 0) return [val];
    }
    return [];
}

// Format array of assigned users along with optional waiting queue members
function formatUsers(userArray = [], queueArray = []) {
    let output = '';
    
    if (Array.isArray(userArray) && userArray.length > 0) {
        output += userArray.map(id => `<@${id}>`).join(', ');
    }
    
    if (Array.isArray(queueArray) && queueArray.length > 0) {
        const queueMentions = queueArray.map(id => `<@${id}> (Queue)`).join(', ');
        output += output ? ` | ⏳ ${queueMentions}` : `⏳ ${queueMentions}`;
    }

    return output;
}

function buildMainEmbed(flight = {}, allocations = {}) {
    const queues = allocations.queues || {};

    // Extract assigned users using alias mappings
    const dc     = getAssignedUsers(allocations, 'dispatchCoordinator', 'dc', 'departureCoordinator');
    const mb     = getAssignedUsers(allocations, 'dispatchSupervisor', 'flightSupervisor', 'mb', 'managementBoard');
    const cpt    = getAssignedUsers(allocations, 'captain', 'cpt');
    const fo     = getAssignedUsers(allocations, 'firstOfficer', 'fo');
    const stbyFd = getAssignedUsers(allocations, 'standbyFlightDeck', 'stbyFd');
    const purser = getAssignedUsers(allocations, 'purser');
    const cc     = getAssignedUsers(allocations, 'cabinCrew', 'cc');
    const stbyCc = getAssignedUsers(allocations, 'standbyCabinCrew', 'stbyCc');
    const ts     = getAssignedUsers(allocations, 'tarmacSupervisor', 'ts');
    const gc     = getAssignedUsers(allocations, 'groundHandling', 'groundCrew', 'gc');
    const stbyGc = getAssignedUsers(allocations, 'standbyGroundCrew', 'stbyGc');
    const bcbd   = getAssignedUsers(allocations, 'bagDropAgent', 'bcbd', 'businessClassBagDrop');
    const ecbd   = getAssignedUsers(allocations, 'economyBagDrop', 'ecbd', 'economyClassBagDrop');
    const cs     = getAssignedUsers(allocations, 'customerService', 'cs');
    const gate   = getAssignedUsers(allocations, 'gateAgent', 'gate');

    const gateText  = flight.gate || 'TBD';
    const staffTime = flight.staff_time || flight.staffTime || 'TBD';
    const paxTime   = flight.passenger_time || flight.passengerTime || 'TBD';

    const description = 
        `${EMOJIS.TAIL} **Allocation List**\n` +
        `${EMOJIS.ARROW} This allocation list is for **${flight.number || 'LO XXX'}** from **${flight.from || 'WARSAW'}** to **${flight.to || 'Destination'}** on **${flight.date || '1st of January'}**.\n` +
        `${EMOJIS.ARROW} **Gate**: ${gateText} | **Personnel Join**: ${staffTime} | **Pax Join**: ${paxTime}\n` +
        `${EMOJIS.ARROW} In order to allocate or unallocate for this flight, please use the dropdown menu below.\n\n` +
        `${EMOJIS.DOT} **Flight Management**\n` +
        `${EMOJIS.ARROW} Departure Coordinator (${dc.length}/1): ${formatUsers(dc, queues.dc || queues.dispatchCoordinator)}\n` +
        `${EMOJIS.ARROW} Management Board: ${formatUsers(mb, queues.mb || queues.dispatchSupervisor)}\n\n` +
        `${EMOJIS.DOT} **Flight Deck**\n` +
        `${EMOJIS.ARROW} Captain (${cpt.length}/1): ${formatUsers(cpt, queues.cpt || queues.captain)}\n` +
        `${EMOJIS.ARROW} First Officer (${fo.length}/1): ${formatUsers(fo, queues.fo || queues.firstOfficer)}\n` +
        `${EMOJIS.ARROW} Stand-by Flight Deck: ${formatUsers(stbyFd, queues.stbyFd || queues.standbyFlightDeck)}\n\n` +
        `${EMOJIS.DOT} **Cabin Crew**\n` +
        `${EMOJIS.ARROW} Purser (${purser.length}/1): ${formatUsers(purser, queues.purser)}\n` +
        `${EMOJIS.ARROW} Cabin Crew (${cc.length}/3): ${formatUsers(cc, queues.cc || queues.cabinCrew)}\n` +
        `${EMOJIS.ARROW} Stand-by Cabin Crew: ${formatUsers(stbyCc, queues.stbyCc || queues.standbyCabinCrew)}\n\n` +
        `${EMOJIS.DOT} **Ground Crew**\n` +
        `${EMOJIS.ARROW} Tarmac Supervisor (${ts.length}/1): ${formatUsers(ts, queues.ts || queues.tarmacSupervisor)}\n` +
        `${EMOJIS.ARROW} Ground Crew (${gc.length}/3): ${formatUsers(gc, queues.gc || queues.groundHandling)}\n` +
        `${EMOJIS.ARROW} Stand-by Ground Crew: ${formatUsers(stbyGc, queues.stbyGc || queues.standbyGroundCrew)}\n\n` +
        `${EMOJIS.DOT} **Airport Worker**\n` +
        `${EMOJIS.ARROW} Business Class Bag Drop (${bcbd.length}/1): ${formatUsers(bcbd, queues.bcbd || queues.bagDropAgent)}\n` +
        `${EMOJIS.ARROW} Economy Class Bag Drop (${ecbd.length}/3): ${formatUsers(ecbd, queues.ecbd)}\n` +
        `${EMOJIS.ARROW} Customer Service (${cs.length}/2): ${formatUsers(cs, queues.cs || queues.customerService)}\n` +
        `${EMOJIS.ARROW} Gate Agent (${gate.length}/1): ${formatUsers(gate, queues.gate || queues.gateAgent)}`;

    return new EmbedBuilder()
        .setColor('#0C2340') // LOT Polish Airlines Navy
        .setDescription(description)
        .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
        .setTimestamp();
}

function buildButtons() {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('alloc_select_role')
        .setPlaceholder('Select a role to allocate or unallocate...')
        .addOptions(
            ROLES.map(role => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(role.label)
                    .setDescription(`Join or leave ${role.label} (max ${role.max})`)
                    .setValue(`alloc_${role.key}`)
            ).concat([
                new StringSelectMenuOptionBuilder()
                    .setLabel('Leave Shift')
                    .setDescription('Unallocate yourself from all assigned roles')
                    .setValue('alloc_unallocate')
                    .setEmoji('❌')
            ])
        );

    return [new ActionRowBuilder().addComponents(selectMenu)];
}

module.exports = {
    ROLES,
    getRoleConfig,
    buildMainEmbed,
    buildButtons,
};
