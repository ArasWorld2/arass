const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROLES = [
  { key: 'dc', label: 'Departure Coordinator', autoFilled: false },
  { key: 'mb', label: 'Management Board', autoFilled: false },
  { key: 'cpt', label: 'Captain', autoFilled: false },
  { key: 'fo', label: 'First Officer', autoFilled: false },
  { key: 'stbyFd', label: 'Stand-by Flight Deck', autoFilled: false },
  { key: 'purser', label: 'Purser', autoFilled: false },
  { key: 'cc', label: 'Cabin Crew', autoFilled: false },
  { key: 'stbyCc', label: 'Stand-by Cabin Crew', autoFilled: false },
  { key: 'ts', label: 'Tarmac Supervisor', autoFilled: false },
  { key: 'gc', label: 'Ground Crew', autoFilled: false },
  { key: 'stbyGc', label: 'Stand-by Ground Crew', autoFilled: false },
  { key: 'bcbd', label: 'Business Class Bag Drop', autoFilled: false },
  { key: 'ecbd', label: 'Economy Class Bag Drop', autoFilled: false },
  { key: 'cs', label: 'Customer Service', autoFilled: false },
  { key: 'gate', label: 'Gate Agent', autoFilled: false },
];

function buildMainEmbed(flight, allocations = {}) {
  // Extract or default values for roles
  const dc = allocations.dc || [];
  const mb = allocations.mb || [];
  const cpt = allocations.cpt || [];
  const fo = allocations.fo || [];
  const stbyFd = allocations.stbyFd || [];
  const purser = allocations.purser || [];
  const cc = allocations.cc || [];
  const stbyCc = allocations.stbyCc || [];
  const ts = allocations.ts || [];
  const gc = allocations.gc || [];
  const stbyGc = allocations.stbyGc || [];
  const bcbd = allocations.bcbd || [];
  const ecbd = allocations.ecbd || [];
  const cs = allocations.cs || [];
  const gate = allocations.gate || [];

  const description = 
    `:LOTTail: **Allocation List**\n` +
    `:Arrow6: This allocation list is for __${flight.number}__ to ${flight.to} on the **${flight.date}**.\n` +
    `:Arrow6: In order to allocate for this flight, please use the allocation channel corresponding to this flight.\n\n` +
    `:Dot: **Flight Management**\n` +
    `:Arrow6:__Departure Coordinator (${dc.length}/1)__: ${dc.join(', ') || ''}\n` +
    `:Arrow6:__Management Board__: ${mb.join(', ') || ''}\n\n` +
    `:Dot: **Flight Deck**\n` +
    `:Arrow6:__Captain (${cpt.length}/1)__: ${cpt.join(', ') || ''}\n` +
    `:Arrow6:__First Officer (${fo.length}/1)__: ${fo.join(', ') || ''}\n` +
    `:Arrow6:__Stand-by Flight Deck__: ${stbyFd.join(', ') || ''}\n\n` +
    `:Dot: **Cabin Crew**\n` +
    `:Arrow6:__Purser (${purser.length}/1)__: ${purser.join(', ') || ''}\n` +
    `:Arrow6:__Cabin Crew (${cc.length}/3)__: ${cc.join(', ') || ''}\n` +
    `:Arrow6:__Stand-by Cabin Crew__: ${stbyCc.join(', ') || ''}\n\n` +
    `:Dot: **Ground Crew**\n` +
    `:Arrow6:__Tarmac Supervisor (${ts.length}/1)__: ${ts.join(', ') || ''}\n` +
    `:Arrow6:__Ground Crew (${gc.length}/3)__: ${gc.join(', ') || ''}\n` +
    `:Arrow6:__Stand-by Ground Crew__: ${stbyGc.join(', ') || ''}\n\n` +
    `:Dot: **Airport Worker**\n` +
    `:Arrow6: __Business Class Bag Drop (${bcbd.length}/1)__: ${bcbd.join(', ') || ''}\n` +
    `:Arrow6:__Economy Class Bag Drop (${ecbd.length}/3)__: ${ecbd.join(', ') || ''}\n` +
    `:Arrow6:__Customer Service (${cs.length}/2)__: ${cs.join(', ') || ''}\n` +
    `:Arrow6:__Gate Agent (${gate.length}/1)*__: ${gate.join(', ') || ''}`;

  return new EmbedBuilder()
    .setColor('#0C2340') // LOT Navy Blue
    .setDescription(description)
    .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
    .setTimestamp();
}

function buildButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('alloc_dc').setLabel('Departure Coordinator').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('alloc_cpt').setLabel('Captain').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_fo').setLabel('First Officer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_purser').setLabel('Purser').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_cc').setLabel('Cabin Crew').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('alloc_ts').setLabel('Tarmac Supervisor').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_gc').setLabel('Ground Crew').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_bcbd').setLabel('Business Bag Drop').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_ecbd').setLabel('Economy Bag Drop').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_cs').setLabel('Customer Service').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('alloc_gate').setLabel('Gate Agent').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('alloc_unallocate').setLabel('Leave Shift').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

module.exports = {
  ROLES,
  buildMainEmbed,
  buildButtons,
};
