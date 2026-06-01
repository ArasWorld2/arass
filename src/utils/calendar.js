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

    const fieldsArray = [];
    const todayEvents = [];
    const upcomingEvents = [];

    // Separate events into Today vs Upcoming
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

    // Sort upcoming events chronologically
    upcomingEvents.sort((a, b) => a.scheduledStartAt - b.scheduledStartAt);

    // 1. Process "Today" section
    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    fieldsArray.push({ name: `━━━ Today (${todayStr}) ━━━`, value: '\u200B', inline: false });

    if (todayEvents.length === 0) {
      fieldsArray.push({ name: 'No flights scheduled today.', value: '\u200B', inline: false });
    } else {
      for (const event of todayEvents) {
        const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
        const eventUrl = `https://discord.com/events/${calendarGuildId}/${event.id}`;
        
        fieldsArray.push({
          name: `<:Wnewtail:1272656069910462464> [**${event.name}**](${eventUrl})`,
          value: `➔ <t:${unixTimestamp}:t> | <t:${unixTimestamp}:d>`,
          inline: false
        });
      }
    }

    // 2. Process "Upcoming Flights" section (Limit to top 5)
    fieldsArray.push({ name: '━━━ Upcoming Flights ━━━', value: '\u200B', inline: false });

    if (upcomingEvents.length === 0) {
      fieldsArray.push({ name: 'No upcoming flights scheduled.', value: '\u200B', inline: false });
    } else {
      const slicedUpcoming = upcomingEvents.slice(0, 5);
      for (const event of slicedUpcoming) {
        const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
        const eventUrl = `https://discord.com/events/${calendarGuildId}/${event.id}`;
        
        fieldsArray.push({
          name: `<:Wnewtail:1272656069910462464> [**${event.name}**](${eventUrl})`,
          value: `➔ <t:${unixTimestamp}:t> | <t:${unixTimestamp}:d>`,
          inline: false
        });
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('<:plane:1414277643314004079> Flight Calendar')
      .setDescription('Below are the scheduled operational sectors:')
      .addFields(fieldsArray)
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