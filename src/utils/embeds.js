const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

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

function buildMainEmbed(flight, allocations = {}) {
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
    `:Arrow6:__Departure Coordinator (${dc.length}/1)__: ${dc.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Management Board__: ${mb.map(u => `<@${u}>`).join(', ')}\n\n` +
    `:Dot: **Flight Deck**\n` +
    `:Arrow6:__Captain (${cpt.length}/1)__: ${cpt.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__First Officer (${fo.length}/1)__: ${fo.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Stand-by Flight Deck__: ${stbyFd.map(u => `<@${u}>`).join(', ')}\n\n` +
    `:Dot: **Cabin Crew**\n` +
    `:Arrow6:__Purser (${purser.length}/1)__: ${purser.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Cabin Crew (${cc.length}/3)__: ${cc.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Stand-by Cabin Crew__: ${stbyCc.map(u => `<@${u}>`).join(', ')}\n\n` +
    `:Dot: **Ground Crew**\n` +
    `:Arrow6:__Tarmac Supervisor (${ts.length}/1)__: ${ts.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Ground Crew (${gc.length}/3)__: ${gc.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Stand-by Ground Crew__: ${stbyGc.map(u => `<@${u}>`).join(', ')}\n\n` +
    `:Dot: **Airport Worker**\n` +
    `:Arrow6: __Business Class Bag Drop (${bcbd.length}/1)__: ${bcbd.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Economy Class Bag Drop (${ecbd.length}/3)__: ${ecbd.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Customer Service (${cs.length}/2)__: ${cs.map(u => `<@${u}>`).join(', ')}\n` +
    `:Arrow6:__Gate Agent (${gate.length}/1)*__: ${gate.map(u => `<@${u}>`).join(', ')}`;

  return new EmbedBuilder()
    .setColor('#0C2340') // LOT Navy Blue
    .setDescription(description)
    .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
    .setTimestamp();
}

function buildButtons() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('alloc_role_select')
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
      ])
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return [row];
}

module.exports = {
  ROLES,
  getRoleConfig,
  buildMainEmbed,
  buildButtons,
};
