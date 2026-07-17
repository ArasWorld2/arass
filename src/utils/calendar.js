const { EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');

// TRACKER CACHE: Keeps a memory of IDs that have ALREADY been announced
const announcedFlightIds = new Set();
let isUpdating = false;
let isCacheInitialized = false;

// Scans the channel history to see what was already posted before a restart
async function initializeAnnouncedCache(channel) {
  if (isCacheInitialized) return;
  try {
    console.log("🔍 Scanning departure channel history to prevent duplicate alerts...");
    const messages = await channel.messages.fetch({ limit: 50 });
    
    for (const [, msg] of messages) {
      // Look for discord event links in old messages (e.g., https://discord.com/events/guildId/eventId)
      const eventLinkRegex = /discord\.com\/events\/\d+\/(\d+)/;
      const match = msg.content.match(eventLinkRegex);
      if (match && match[1]) {
        announcedFlightIds.add(match[1]);
      }
    }
    isCacheInitialized = true;
    console.log(`✅ Cache initialized. Ignored ${announcedFlightIds.size} previously sent flight alerts.`);
  } catch (err) {
    // If we can't scan this channel due to access rules, check the error code
    if (err.code === 50001 || err.code === 10003) return;
    console.error("⚠️ Failed to scan channel history cache:", err.message);
  }
}

async function updateCalendar(client) {
  const calendarChannelId = process.env.CALENDAR_CHANNEL_ID;
  let calendarMessageId   = process.env.CALENDAR_MESSAGE_ID;
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

      const line = `<:Wnewtail:1272656069910462464> **${cleanEventName}** | ${timeHammerTime} | ${dateHammerTime}`;

      if (eventDay.getTime() === today.getTime()) {
        todayEvents.push(line);
      } else if (eventDay > today) {
        upcomingEvents.push({ line, date: event.scheduledStartAt });
      }
    }

    upcomingEvents.sort((a, b) => a.date - b.date);

    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let descriptionText = "Below are the upcoming flights:\n\n";
    
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
      .setAuthor({ 
        name: 'Wizz Air — Flight Operations',
        iconURL: guild.iconURL({ dynamic: true, size: 128 }) || undefined
      })
      .setTitle('<:plane:1414277643314004079> Flight Calendar')
      .setDescription(descriptionText)
      .setFooter({ text: 'Wizz Air Operations' });

    const channel = await client.channels.fetch(calendarChannelId);

    if (!calendarMessageId) {
      console.log("🔍 No CALENDAR_MESSAGE_ID provided. Searching channel history for an existing calendar...");
      const history = await channel.messages.fetch({ limit: 20 });
      const existingCalendar = history.find(msg => 
        msg.author.id === client.user.id && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title === '<:plane:1414277643314004079> Flight Calendar'
      );
      
      if (existingCalendar) {
        calendarMessageId = existingCalendar.id;
        console.log(`📌 Found an existing calendar message! Using ID: ${calendarMessageId}`);
      }
    }

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
    // Prevent console spam if calendar channel is missing access overrides
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
    const events = await guild.scheduledEvents.fetch();
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

      if (hoursUntilDeparture <= 20 && hoursUntilDeparture > 0) {
        
        announcedFlightIds.add(event.id);

        const day = String(event.scheduledStartAt.getDate()).padStart(2, '0');
        const month = String(event.scheduledStartAt.getMonth() + 1).padStart(2, '0');
        const year = event.scheduledStartAt.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        const cleanEventName = event.name.replace(/[\[\]\*]/g, '').trim();
        
        const unixTimestamp = Math.floor(event.scheduledStartAt.getTime() / 1000);
        const relativeHammerTime = `<t:${unixTimestamp}:R>`;

        const pingTarget = pingRoleId ? `<@&${pingRoleId}>` : '@everyone';
        const ghostPingMessage = await departuresChannel.send({ content: pingTarget });
        await ghostPingMessage.delete().catch(() => console.log("Ghost ping safe clean"));

        const flightAlertLayout = 
          `### <:takeoff:1414277645134200955> Scheduled Flight\n` +
          `-# <:blank:1296498991114227763> \`${formattedDate}\` \n\n` +
          `> We would like to remind you that flight **${cleanEventName}** is scheduled to depart **${relativeHammerTime}**. For your convenience, all **relevant details for the departure** may be found in the event card shared below. If you have any inquiries or concerns about the upcoming itinerary, please don't hesitate to let us know through contacting **<@1297542149620891788>**.\n` +
          ` <:announcement:1414277746233708669> Please be advised that you must be a member of our [**Roblox Group**](<https://www.roblox.com/communities/822510972/w-zzair-rblx#!/about>) to join flights. On behalf of **Air Dolomiti**, we wish you a pleasant journey.\n\n` +
          `-# <:link:1414278009573347328> [**${cleanEventName}**](<${event.url}>)`;

        await departuresChannel.send({ 
          content: flightAlertLayout 
        });

        console.log(`📢 Custom alert posted cleanly for flight: ${cleanEventName}`);
      }
    }

  } catch (err) {
    // FIX COMPLETED: Bypass log spam entirely if it hits Missing Access (50001) or Unknown Channel (10003)
    if (err.code === 50001 || err.code === 10003) {
      return; 
    }
    console.error('Error running departures alert engine:', err.message);
  }
}

function startCalendarLoop(client) {
  updateCalendar(client);
  checkUpcomingDepartures(client); 

  setInterval(async () => {
    if (isUpdating) return;
    isUpdating = true;
    try {
      await updateCalendar(client);
      await checkUpcomingDepartures(client);
    } catch (err) {
      if (err.code === 50001 || err.code === 10003) return;
      console.error('Error in calendar interval loop:', err);
    } finally {
      isUpdating = false;
    }
  }, 300000);
}

module.exports = { startCalendarLoop, updateCalendar, checkUpcomingDepartures };