const { EmbedBuilder } = require('discord.js');

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

module.exports = {
  buildMainEmbed,
  // export buildButtons and any other helper functions here...
};
