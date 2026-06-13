const { EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');

// TRACKER CACHE: Keeps a memory of IDs that have ALREADY been announced
// This completely stops duplicate pings if loops run while Discord's API lags
const announcedFlightIds = new Set();

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
      if (
        event.status === GuildScheduledEventStatus.Canceled || 
        event.status === GuildScheduledEventStatus.Completed
      ) {
        continue;
      }

      if (!event.scheduledStartAt) continue;

      const timeDiffMs = event.scheduledStartAt.getTime() - now.getTime();
      const hoursUntilDeparture = timeDiffMs / (1000 * 60 * 60);

      // STRICT CHECK: If this flight ID is already inside our announced memory, skip it entirely!
      if (announcedFlightIds.has(event.id)) {
        continue;
      }

      if (hoursUntilDeparture <= 20 && hoursUntilDeparture > 0) {
        
        // Add to announced cache BEFORE running any code so it locks instantly
        announcedFlightIds.add(event.id);

        const day = String(event.scheduledStartAt.getDate()).padStart(2, '0');
        const month = String(event.scheduledStartAt.getMonth() + 1).padStart(2, '0');
        const year = event.scheduledStartAt.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        const cleanEventName = event.name.replace(/[\[\]\*]/g, '').trim();
        
        // 1. EXECUTE THE ROLE GHOST PING
        const pingTarget = pingRoleId ? `<@&${pingRoleId}>` : '@everyone';
        const ghostPingMessage = await departuresChannel.send({ content: pingTarget });
        await ghostPingMessage.delete().catch(() => console.log("Ghost ping safe clean"));

        // 2. CONSTRUCT YOUR BRAND NEW CUSTOM PLAIN TEXT LAYOUT
        const flightAlertLayout = 
          `### <:takeoff:1414277645134200955> Scheduled Flight\n` +
          `-# <:blank:1296498991114227763> \`${formattedDate}\` <:calender:1414278015440912415> \n\n` +
          `> We are excited to share that **one** new flight has been added to this week's schedule. For your convenience, all **relevant details for the departure** may be found in the event card shared below. If you have any inquiries or concerns about the upcoming itinerary, please don't hesitate to let us know through contacting **<@1297542149620891788>**.\n` +
          `<:arrow:1414277373909794937> Please be advised that you must be a member of our [**Roblox Group**](<https://www.roblox.com/communities/16137621/w-zzair-rblx#!/about>) to join flights. On behalf of **Wizz Air**, we wish you a pleasant journey.\n\n` +
          `-# <:link:1414278009573347328> [**${cleanEventName}**](<${event.url}>)`;

        // 3. DISPATCH THE MESSAGE
        await departuresChannel.send({ 
          content: flightAlertLayout 
        });

        console.log(`📢 Custom alert posted cleanly for flight: ${cleanEventName}`);
      }
    }

  } catch (err) {
    console.error('Error running departures alert engine:', err.message);
  }
}

module.exports = { updateCalendar, checkUpcomingDepartures };