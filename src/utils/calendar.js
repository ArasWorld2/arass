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

    const todayEvents      = [];
    const upcomingDates    = [];
    const upcomingFlights  = [];

    for (const [, event] of events) {
      if (!event.scheduledStartAt) continue;
      
      const eventDay = new Date(
        event.scheduledStartAt.getFullYear(),
        event.scheduledStartAt.getMonth(),
        event.scheduledStartAt.getDate()
      );

      // Convert to Discord Unix Timestamp (Hammer Time)
      const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
      const timeHammerTime = `<t:${unixTimestamp}:t>`;      // Short Time format (e.g., 16:00)
      const dateHammerTime = `<t:${unixTimestamp}:d>`;      // Short Date format (e.g., 31/05/2026)

      if (eventDay.getTime() === today.getTime()) {
        const line = `<:Wnewtail:1272656069910462464> **${event.name}** | ${timeHammerTime}`;
        todayEvents.push(line);
      } else if (eventDay > today) {
        upcomingDates.push({ string: dateHammerTime, date: event.scheduledStartAt });
        upcomingFlights.push({ 
          string: `<:Wnewtail:1272656069910462464> **${event.name}** | ${timeHammerTime}`, 
          date: event.scheduledStartAt 
        });
      }
    }

    // Sort upcoming events by date chronologically
    upcomingDates.sort((a, b) => a.date - b.date);
    upcomingFlights.sort((a, b) => a.date - b.date);

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Slice to top 5 upcoming entries
    const slicedDates = upcomingDates.slice(0, 5).map(d => d.string).join('\n');
    const slicedFlights = upcomingFlights.slice(0, 5).map(f => f.string).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('<:plane:1414277643314004079> Flight Calendar')
      .setDescription('Below are the upcoming flights:')
      .addFields(
        {
          name: `Today (${todayStr}):`,
          value: todayEvents.length > 0 ? todayEvents.join('\n') : 'No flights scheduled today.',
          inline: false,
        },
        {
          name: '📅 Date',
          value: upcomingDates.length > 0 ? slicedDates : 'No upcoming flights.',
          inline: true,
        },
        {
          name: '✈️ Flight & Time',
          value: upcomingFlights.length > 0 ? slicedFlights : 'No upcoming flights.',
          inline: true,
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
