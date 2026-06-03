const { EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');

// Track sent alerts in memory so the bot doesn't duplicate them on loop runs
const sentAlerts = new Set();

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
      // CRITICAL FIX: If the event is canceled or completed, skip it entirely!
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

      const line = `<:Wnewtail:1272656069910462464> **${cleanEventName}** | ${timeHammerTime} | ${dateHammerTime}`;

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
      .setColor(0xC6007E)
      .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
      .setTitle('<:plane:1414277643314004079> Flight Calendar')
      .setDescription(descriptionText)
      .setFooter({ text: 'Wizz Air Operations' })
      .setTimestamp();

    const channel = await client.channels.fetch(calendarChannelId);

    if (calendarMessageId) {
      try {
        const msg = await channel.messages.fetch(calendarMessageId);
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

async function checkUpcomingDepartures(client) {
  const departuresChannelId = process.env.DEPARTURES_CHANNEL_ID;
  const calendarGuildId     = process.env.CALENDAR_GUILD_ID;
  const pingRoleId          = process.env.PING_ROLE_ID; 
  
  if (!departuresChannelId || !calendarGuildId) return;

  try {
    const guild = await client.guilds.fetch(calendarGuildId);
    const events = await guild.scheduledEvents.fetch();
    const departuresChannel = await client.channels.fetch(departuresChannelId);

    const now = new Date();

    for (const [, event] of events) {
      // CRITICAL FIX: If the event is canceled or completed, do not alert or ghost-ping!
      if (
        event.status === GuildScheduledEventStatus.Canceled || 
        event.status === GuildScheduledEventStatus.Completed
      ) {
        continue;
      }

      if (!event.scheduledStartAt) continue;

      const timeDiffMs = event.scheduledStartAt.getTime() - now.getTime();
      const hoursUntilDeparture = timeDiffMs / (1000 * 60 * 60);

      if (hoursUntilDeparture <= 20 && hoursUntilDeparture > 0 && !sentAlerts.has(event.id)) {
        
        const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
        const cleanEventName = event.name.replace(/[\[\]\*]/g, '').trim();
        
        // 1. EXECUTE THE ROLE GHOST PING
        const pingTarget = pingRoleId ? `<@&${pingRoleId}>` : '@everyone';
        const ghostPingMessage = await departuresChannel.send({ content: pingTarget });
        await ghostPingMessage.delete().catch(() => console.log("Ghost ping safe clean"));

        // 2. CONSTRUCT CLEAN PLAIN-TEXT WORKFLOW LAYOUT
        const plainTextMessage = 
          `✈️ **WIZZ AIR — UPCOMING FLIGHT DEPARTURE ALERT** ✈️\n\n` +
          `A new departure check window has opened. Please prepare your flight assignments and dispatch rosters!\n\n` +
          `🔹 **Sector:** **${cleanEventName}**\n` +
          `🔹 **Departure Time:** <t:${unixTimestamp}:t> (<t:${unixTimestamp}:R>)\n` +
          `🔹 **Scheduled Date:** <t:${unixTimestamp}:d>\n\n` +
          `Click "Interested" on the interactive operational card attached below to book your slot:\n` +
          `${event.url}`;

        // 3. SEND AS REGULAR TEXT
        await departuresChannel.send({ 
          content: plainTextMessage 
        });

        sentAlerts.add(event.id);
        console.log(`📢 Plain text alert & ghost-ping deployed successfully for: ${cleanEventName}`);
      }
    }
  } catch (err) {
    console.error('Error running departures alert engine:', err.message);
  }
}

module.exports = { updateCalendar, checkUpcomingDepartures };