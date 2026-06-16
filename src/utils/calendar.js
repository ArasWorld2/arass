const { EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');

let isUpdating = false;

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
      if (
        event.status === GuildScheduledEventStatus.Canceled || 
        event.status === GuildScheduledEventStatus.Completed
      ) {
        continue;
      }

      if (!event.scheduledStartAt) continue;
      
      const eventDay = new Date(
        event.scheduledStartAt.getFullYear(),
        event.scheduledStartAt.getMonth(),
        event.scheduledStartAt.getDate()
      );

      const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
      const timeHammerTime = `<t:${unixTimestamp}:t>`;      
      const dateHammerTime = `<t:${unixTimestamp}:d>`;      

      const cleanEventName = event.name.replace(/[\[\]\*]/g, '').trim();

      const line = `< **${cleanEventName}** | ${timeHammerTime} | ${dateHammerTime}`;

      if (eventDay.getTime() === today.getTime()) {
        todayEvents.push(line);
      } else if (eventDay > today) {
        upcomingEvents.push({ line, date: event.scheduledStartAt });
      }
    }

    upcomingEvents.sort((a, b) => a.date - b.date);

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let descriptionText = "Below are the upcoming operational sectors:\n\n";
    
    descriptionText += `**Today (${todayStr}):**\n`;
    if (todayEvents.length > 0) {
      descriptionText += todayEvents.join('\n') + '\n\n';
    } else {
      descriptionText += 'No flights scheduled today.\n\n';
    }

    descriptionText += `**Upcoming Flights:**\n`;
    if (upcomingEvents.length > 0) {
      descriptionText += upcomingEvents.slice(0, 10).map(f => f.line).join('\n');
    } else {
      descriptionText += 'No upcoming flights scheduled.';
    }

    const embed = new EmbedBuilder()
      .setColor(0x006570)
      .setAuthor({ name: 'Air Dolomiti — Flight Operations' }) // FIXED: Removed invalid "https://" string
      .setTitle('✈️ Flight Calendar')
      .setDescription(descriptionText)
      .setFooter({ text: 'Air Dolomiti Operations' })
      .setTimestamp();

    const channel = await client.channels.fetch(calendarChannelId);

    // FIXED: Correctly handles bad/deleted message IDs instead of silently failing
    if (calendarMessageId) {
      try {
        const msg = await channel.messages.fetch(calendarMessageId);
        await msg.edit({ content: '', embeds: [embed] });
        return; 
      } catch (fetchErr) {
        console.log("Old calendar message ID was not found or couldn't be edited. Sending a new one...");
      }
    }

    const newMsg = await channel.send({ content: '', embeds: [embed] });
    console.log(`📅 New Calendar posted! Update your environment variables with: CALENDAR_MESSAGE_ID=${newMsg.id}`);

  } catch (err) {
    console.error('Calendar update error:', err);
  }
}

function startCalendarLoop(client) {
  // Run once immediately on startup
  updateCalendar(client);

  // Run every 5 minutes (300000ms)
  setInterval(async () => {
    if (isUpdating) return;
    isUpdating = true;
    try {
      await updateCalendar(client);
    } catch (err) {
      console.error('Error in calendar interval loop:', err);
    } finally {
      isUpdating = false;
    }
  }, 300000);
}

module.exports = { startCalendarLoop, updateCalendar };