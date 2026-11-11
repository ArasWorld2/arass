const { EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');

// Custom LOT Emojis
const EMOJIS = {
  TAIL: '<:LOTTail:1520114549490057226>'
};

let isUpdating = false;

async function updateCalendar(client) {
  const calendarChannelId = process.env.CALENDAR_CHANNEL_ID;
  let calendarMessageId   = process.env.CALENDAR_MESSAGE_ID;
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
      .setColor('#0C2340')
      .setAuthor({ 
        name: 'LOT Polish Airlines — Flight Operations',
        iconURL: guild.iconURL({ dynamic: true, size: 128 }) || undefined
      })
      .setTitle(`${EMOJIS.TAIL} Flight Timetable & Schedule`)
      .setDescription(descriptionText)
      .setFooter({ text: 'LOT Polish Airlines Operations' });

    const channel = await client.channels.fetch(calendarChannelId);

    if (!calendarMessageId) {
      console.log("🔍 Searching channel history for existing calendar message...");
      const history = await channel.messages.fetch({ limit: 20 });
      const existingCalendar = history.find(msg => 
        msg.author.id === client.user.id && 
        msg.embeds.length > 0 && 
        msg.embeds[0].title &&
        msg.embeds[0].title.includes('Flight Timetable')
      );
      
      if (existingCalendar) {
        calendarMessageId = existingCalendar.id;
        console.log(`📌 Found calendar message ID: ${calendarMessageId}`);
      }
    }

    if (calendarMessageId) {
      try {
        const msg = await channel.messages.fetch(calendarMessageId);
        await msg.edit({ content: '', embeds: [embed] });
        return; 
      } catch (fetchErr) {
        console.log("Old calendar message not found. Sending a new one...");
      }
    }

    const newMsg = await channel.send({ content: '', embeds: [embed] });
    console.log(`📅 New Calendar posted! CALENDAR_MESSAGE_ID=${newMsg.id}`);

  } catch (err) {
    if (err.code === 50001 || err.code === 10003) return;
    console.error('Calendar update error:', err);
  }
}

function startCalendarLoop(client) {
  updateCalendar(client);

  setInterval(async () => {
    if (isUpdating) return;
    isUpdating = true;
    try {
      await updateCalendar(client);
    } catch (err) {
      if (err.code === 50001 || err.code === 10003) return;
      console.error('Error in calendar interval loop:', err);
    } finally {
      isUpdating = false;
    }
  }, 300000);
}

module.exports = { startCalendarLoop, updateCalendar };
