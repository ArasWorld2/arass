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

    for (const [, event] of events) {
      if (!event.scheduledStartAt) continue;
      
      const eventDay = new Date(
        event.scheduledStartAt.getFullYear(),
        event.scheduledStartAt.getMonth(),
        event.scheduledStartAt.getDate()
      );

      // Convert to Discord Unix Timestamps (Hammer Time)
      const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
      const timeHammerTime = `<t:${unixTimestamp}:t>`;
      const dateHammerTime = `<t:${unixTimestamp}:d>`;

      // Construct a clean format by keeping the hyperlink on its own distinct line snippet block
      const eventUrl = `https://discord.com/events/${calendarGuildId}/${event.id}`;
      
      // Clean format: Emote + Name + Time + Date, with a clean link on the line directly below it
      const line = `<:Wnewtail:1272656069910462464> **${event.name}** | ${timeHammerTime} | ${dateHammerTime}\n↳ [Click to view Event Card](${eventUrl})`;

      if (eventDay.getTime() === today.getTime()) {
        todayEvents.push(line);
      } else if (eventDay > today) {
        upcomingEvents.push({ line, date: event.scheduledStartAt });
      }
    }

    // Sort upcoming flights chronologically
    upcomingEvents.sort((a, b) => a.date - b.date);

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Use double-line breaks (\n\n) to neatly separate the multi-line events
    const embed = new EmbedBuilder()
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('<:plane:1414277643314004079> Flight Calendar')
      .setDescription('Below are the upcoming flights:')
      .addFields(
        {
          name: `Today (${todayStr}):`,
          value: todayEvents.length > 0 ? todayEvents.join('\n\n') : 'No flights scheduled today.',
        },
        {
          name: 'Upcoming Flights:',
          value: upcomingEvents.length > 0
            ? upcomingEvents.slice(0, 5).map(f => f.line).join('\n\n')
            : 'No upcoming flights scheduled.',
        }
      )
      .setFooter({ text: 'Wizz Air Operations' })
      .setTimestamp();

    const channel = await client.channels.fetch(calendarChannelId);

    if (calendarMessageId) {
      try {
        const msg = await channel.messages.fetch(calendarMessageId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {}
    }

    const newMsg = await channel.send({ embeds: [embed] });
    console.log(`📅 Calendar posted! Add CALENDAR_MESSAGE_ID=${newMsg.id} to Railway variables`);

  } catch (err) {
    console.error('Calendar update error:', err.message);
  }
}

module.exports = { updateCalendar };
