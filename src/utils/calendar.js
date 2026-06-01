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

    // Categorize events
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

    const embed = new EmbedBuilder()
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('📅 Upcoming Flights')
      .setFooter({ text: '© Wizz Air – All Rights Reserved' })
      .setTimestamp();

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    
    // 1. Process "Today" Section using Qatar structural layout blocks
    embed.addFields({ name: `Today (${todayStr})`, value: '\u200B', inline: false });

    if (todayEvents.length === 0) {
      embed.addFields({ name: ' No flights scheduled today.', value: '\u200B', inline: false });
    } else {
      for (const event of todayEvents) {
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

    // 2. Process "Upcoming" Section 
    embed.addFields({ name: '\u200B', value: '\u200B', inline: false }); // Empty spacing block
    embed.addFields({ name: 'Upcoming Sectors', value: '\u200B', inline: false });

    if (upcomingEvents.length === 0) {
      embed.addFields({ name: ' No upcoming sectors scheduled.', value: '\u200B', inline: false });
    } else {
      // Limit to top 5 upcoming sectors
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