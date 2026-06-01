const { EmbedBuilder } = require('discord.js');

async function updateCalendar(client) {
  const calendarChannelId = process.env.CALENDAR_CHANNEL_ID;
  const calendarMessageId = process.env.CALENDAR_MESSAGE_ID;
  const calendarGuildId   = process.env.CALENDAR_GUILD_ID;
  if (!calendarChannelId || !calendarGuildId) return;

  try {
    const guild = await client.guilds.fetch(calendarGuildId);
    const events = await guild.scheduledEvents.fetch();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayEvents    = [];
    const upcomingEvents = [];

    // Separate flights chronologically
    for (const [, event] of events) {
      if (!event.scheduledStartAt) continue;
      
      const eventDay = new Date(
        event.scheduledStartAt.getFullYear(),
        event.scheduledStartAt.getMonth(),
        event.scheduledStartAt.getDate()
      );

      if (eventDay.getTime() === today.getTime()) {
        todayEvents.push(event);
      } else if (eventDay > today) {
        upcomingEvents.push(event);
      }
    }

    upcomingEvents.sort((a, b) => a.scheduledStartAt - b.scheduledStartAt);

    // Instantiate Embed Core Layout
    const embed = new EmbedBuilder()
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('📅 Flight Calendar')
      .setDescription('Below are the upcoming operational flights:') // Clean description text block
      .setFooter({ text: 'Wizz Air Operations' })
      .setTimestamp();

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

    // 1. PROCESS TODAY SECTOR BLOCK
    embed.addFields({ name: `Today (${todayStr})`, value: '\u200B', inline: false });

    if (todayEvents.length === 0) {
      embed.addFields({ name: ' No flights scheduled today.', value: '\u200B', inline: false });
    } else {
      for (const event of todayEvents) {
        const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
        const eventUrl = `https://discord.com/events/${calendarGuildId}/${event.id}`;
        const cleanName = event.name.replace(/[\[\]\*]/g, '').trim();

        // Placing markdown hyperlinks inside the Field Title (name) or Field Content (value)
        // forces Discord to parse it into a clean blue hyperlinked element like Qatar Airways!
        embed.addFields({
          name: `<:Wnewtail:1272656069910462464> [**${cleanName}**](${eventUrl})`,
          value: `> **Join Time:** <t:${unixTimestamp}:t>\n> **Date:** <t:${unixTimestamp}:d>`,
          inline: false
        });
      }
    }

    // 2. PROCESS UPCOMING FLIGHTS BLOCK
    embed.addFields({ name: '\u200B', value: '\u200B', inline: false }); // Layout spacer line
    embed.addFields({ name: 'Upcoming Flights', value: '\u200B', inline: false });

    if (upcomingEvents.length === 0) {
      embed.addFields({ name: ' No upcoming sectors scheduled.', value: '\u200B', inline: false });
    } else {
      // Limit list viewport to top 5 chronological rows
      const slicedUpcoming = upcomingEvents.slice(0, 5);
      for (const event of slicedUpcoming) {
        const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
        const eventUrl = `https://discord.com/events/${calendarGuildId}/${event.id}`;
        const cleanName = event.name.replace(/[\[\]\*]/g, '').trim();

        embed.addFields({
          name: `<:Wnewtail:1272656069910462464> [**${cleanName}**](${eventUrl})`,
          value: `> **Join Time:** <t:${unixTimestamp}:t>\n> **Date:** <t:${unixTimestamp}:d>`,
          inline: false
        });
      }
    }

    const channel = await client.channels.fetch(calendarChannelId);

    if (calendarMessageId) {
      try {
        const msg = await channel.messages.fetch(calendarMessageId);
        // Clean out any rogue plain-text context flags from earlier test iterations
        await msg.edit({ content: '', embeds: [embed] });
        return;
      } catch {}
    }

    const newMsg = await channel.send({ content: '', embeds: [embed] });
    console.log(`📅 Calendar posted! Add CALENDAR_MESSAGE_ID=${newMsg.id} to Railway variables`);

  } catch (err) {
    console.error('Calendar update error:', err.message);
  }
}

module.exports = { updateCalendar };