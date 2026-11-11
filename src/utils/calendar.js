const { EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');

// Custom LOT Emojis
const EMOJIS = {
  TAIL: '<:LOTTail:1520114549490057226>',
  ARROW1: '<:LOTSArrow:1520114515318935584>',
  ARROW2: '<:LOTSArrow:1520114515318935584>',
  MANAGER: '<:LOTSManager:1520114571124150373>',
  CLICK: '<:leftclick:1520114571124150373>'
};

// TRACKER CACHE: Tracks event IDs that have received a 20-hour alert
const announcedFlightIds = new Set();
let isCalendarUpdating = false;
let isCacheInitialized = false;

// Scans channel history specifically for existing 20-HOUR ALERTS on boot
async function initializeAnnouncedCache(channel) {
  if (isCacheInitialized) return;
  try {
    console.log("🔍 Scanning departure channel history for existing LOT 20h alerts...");
    const messages = await channel.messages.fetch({ limit: 100 });
    
    for (const [, msg] of messages) {
      if (msg.content && (msg.content.includes("Day of Travel Information") || msg.content.includes("LOT Polish Airlines"))) {
        const eventLinkRegex = /discord\.com\/events\/\d+\/(\d+)/;
        const match = msg.content.match(eventLinkRegex);
        if (match && match[1]) {
          announcedFlightIds.add(match[1]);
        }
      }
    }
    isCacheInitialized = true;
    console.log(`✅ Cache initialized. Ignored ${announcedFlightIds.size} previously sent 20-hour alerts.`);
  } catch (err) {
    if (err.code === 50001 || err.code === 10003) return;
    console.error("⚠️ Failed to scan channel history cache:", err.message);
  }
}

async function updateCalendar(client) {
  const calendarChannelId = process.env.CALENDAR_CHANNEL_ID;
  const calendarGuildId   = process.env.CALENDAR_GUILD_ID;
  if (!calendarChannelId || !calendarGuildId) return;

  try {
    const guild = await client.guilds.fetch(calendarGuildId);
    const events = await guild.scheduledEvents.fetch({ force: true });

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

      const line = `${EMOJIS.TAIL} **${cleanEventName}** | ${timeHammerTime} | ${dateHammerTime}`;

      if (eventDay.getTime() === today.getTime()) {
        todayEvents.push(line);
      } else if (eventDay > today) {
        upcomingEvents.push({ line, date: event.scheduledStartAt });
      }
    }

    upcomingEvents.sort((a, b) => a.date - b.date);

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let descriptionText = "Below are the upcoming LOT Polish Airlines operations:\n\n";
    
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
      .setColor('#0C2340') // LOT Navy Blue
      .setAuthor({ 
        name: 'LOT Polish Airlines — Flight Operations',
        iconURL: guild.iconURL({ dynamic: true, size: 128 }) || undefined
      })
      .setTitle(`${EMOJIS.TAIL} Flight Timetable & Schedule`)
      .setDescription(descriptionText)
      .setFooter({ text: 'LOT Polish Airlines Operations' });

    const channel = await client.channels.fetch(calendarChannelId);

    // Auto-search channel history for existing calendar embed created by the bot
    const history = await channel.messages.fetch({ limit: 50 });
    const existingMsg = history.find(msg => 
      msg.author.id === client.user.id && 
      msg.embeds.length > 0 && 
      msg.embeds[0].title &&
      msg.embeds[0].title.includes('Flight Timetable')
    );

    if (existingMsg) {
      // Edit the existing calendar message in place
      await existingMsg.edit({ content: '', embeds: [embed] });
      return; 
    }

    // If no existing message was found, send it once
    await channel.send({ content: '', embeds: [embed] });
    console.log('📅 New Calendar posted cleanly!');

  } catch (err) {
    if (err.code === 50001 || err.code === 10003) return;
    console.error('Calendar update error:', err);
  }
}

async function checkUpcomingDepartures(client) {
  const departuresChannelId = process.env.DEPARTURES_CHANNEL_ID;
  const calendarGuildId     = process.env.CALENDAR_GUILD_ID;
  const pingRoleId          = process.env.PING_ROLE_ID; 
  
  if (!departuresChannelId || !calendarGuildId) return;

  try {
    const guild = await client.guilds.fetch(calendarGuildId);
    const events = await guild.scheduledEvents.fetch({ force: true });
    const departuresChannel = await client.channels.fetch(departuresChannelId);

    await initializeAnnouncedCache(departuresChannel);

    const now = new Date();

    for (const [, event] of events) {
      if (
        event.status === GuildScheduledEventStatus.Canceled || 
        event.status === GuildScheduledEventStatus.Completed
      ) {
        continue;
      }

      if (!event.scheduledStartAt) continue;

      const timeDiffMs = event.scheduledStartAt.getTime() - now.getTime();
      const hoursUntilDeparture = timeDiffMs / (1000 * 60 * 60);

      if (announcedFlightIds.has(event.id)) {
        continue;
      }

      // 20-hour departure window trigger
      if (hoursUntilDeparture <= 20 && hoursUntilDeparture > 0) {
        
        announcedFlightIds.add(event.id);

        const cleanEventName = event.name.replace(/[\[\]\*]/g, '').trim();
        const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);

        // Ghost ping role or @everyone
        const pingTarget = pingRoleId ? `<@&${pingRoleId}>` : '@everyone';
        try {
          const ghostPingMessage = await departuresChannel.send({ content: pingTarget });
          await ghostPingMessage.delete().catch(() => {});
        } catch {}

        // Standardized LOT Day of Travel Information Announcement Layout
        const flightAlertLayout = 
          `${EMOJIS.TAIL} **Day of Travel Information**\n` +
          `**${cleanEventName}**\n\n` +
          `${EMOJIS.ARROW2}  **Aircraft**: Boeing 737-800 SP-LVD\n` +
          `${EMOJIS.ARROW2}  **Gate Number**: Revealed U T H\n\n` +
          `${EMOJIS.ARROW1}Server opens <t:${unixTimestamp - 900}:t>. Boarding begins <t:${unixTimestamp}:t>.\n` +
          `${EMOJIS.ARROW1}In order to __drop your bags__, please go to check-in at desks **C01-C05**.\n` +
          `${EMOJIS.ARROW1}You may be refused boarding if you do not have the appropriate travel documents and/or are late.\n\n` +
          `__Z wyrazami szacunku,__\n` +
          `${EMOJIS.MANAGER} **LOT Flight Operations**\n` +
          `*Flight Operations Department*\n\n` +
          `-# ${EMOJIS.CLICK} [**Event Link**](<${event.url}>)`;

        await departuresChannel.send({ 
          content: flightAlertLayout 
        });

        console.log(`📢 Day of Travel alert posted cleanly for flight: ${cleanEventName}`);
      }
    }

  } catch (err) {
    if (err.code === 50001 || err.code === 10003) return;
    console.error('Error running departures alert engine:', err.message);
  }
}

function startCalendarLoop(client) {
  const runTasks = async () => {
    if (isCalendarUpdating) return;
    isCalendarUpdating = true;
    try {
      await updateCalendar(client);
      await checkUpcomingDepartures(client);
    } catch (err) {
      if (err.code === 50001 || err.code === 10003) return;
      console.error('Error in calendar interval loop:', err);
    } finally {
      isCalendarUpdating = false;
    }
  };

  // Immediate execution on startup
  runTasks();

  // Scheduled execution every 5 minutes
  setInterval(runTasks, 300000);
}

module.exports = { startCalendarLoop, updateCalendar, checkUpcomingDepartures };
