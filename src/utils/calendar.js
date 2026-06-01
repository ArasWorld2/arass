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

      const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
      const timeHammerTime = `<t:${unixTimestamp}:t>`;      
      const dateHammerTime = `<t:${unixTimestamp}:d>`;      
      const cleanName = event.name.replace(/[\[\]\*]/g, '').trim();

      // Create a clean line for the embed without any broken markdown links
      const embedLine = `<:Wnewtail:1272656069910462464> **${cleanName}** | ${timeHammerTime} | ${dateHammerTime}`;
      
      // Create the native plain-text event tag to place outside the embed
      const nativeTag = `<@${event.id}>`;

      if (eventDay.getTime() === today.getTime()) {
        todayEvents.push({ embedLine, nativeTag });
      } else if (eventDay > today) {
        upcomingEvents.push({ embedLine, nativeTag, date: event.scheduledStartAt });
      }
    }

    // Sort upcoming flights chronologically
    upcomingEvents.sort((a, b) => a.date - b.date);

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Build the clean Embed Description text block
    let descriptionText = "Below are the upcoming operational sectors:\n\n";
    
    descriptionText += `**Today (${todayStr}):**\n`;
    if (todayEvents.length > 0) {
      descriptionText += todayEvents.map(e => e.embedLine).join('\n') + '\n\n';
    } else {
      descriptionText += 'No flights scheduled today.\n\n';
    }

    descriptionText += `**Upcoming Flights:**\n`;
    if (upcomingEvents.length > 0) {
      descriptionText += upcomingEvents.slice(0, 5).map(e => e.embedLine).join('\n');
    } else {
      descriptionText += 'No upcoming flights scheduled.';
    }

    const embed = new EmbedBuilder()
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('<:plane:1414277643314004079> Flight Calendar')
      .setDescription(descriptionText)
      .setFooter({ text: 'Wizz Air Operations' })
      .setTimestamp();

    // Collect all native event badges to send in the plain-text message block
    const allTags = [...todayEvents, ...upcomingEvents.slice(0, 5)].map(e => e.nativeTag);
    const contentString = allTags.length > 0 ? `✈️ **Quick Links to Event Cards:**\n${allTags.join('  ')}` : '';

    const channel = await client.channels.fetch(calendarChannelId);

    // If updating an existing message, send both content text and embed
    if (calendarMessageId) {
      try {
        const msg = await channel.messages.fetch(calendarMessageId);
        await msg.edit({ content: contentString, embeds: [embed] });
        return;
      } catch {}
    }

    const newMsg = await channel.send({ content: contentString, embeds: [embed] });
    console.log(`📅 Calendar posted! Add CALENDAR_MESSAGE_ID=${newMsg.id} to Railway variables`);

  } catch (err) {
    console.error('Calendar update error:', err.message);
  }
}

module.exports = { updateCalendar };