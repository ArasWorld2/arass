const { EmbedBuilder } = require('discord.js');

// Parse a date string like "Saturday, 9 May 2026 12:15" into a Date object
function parseStaffTime(staffTime) {
  try {
    const cleaned = staffTime.replace(/(\d+)(st|nd|rd|th)/, '$1');
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) return date;

    // Try manual parse: "Saturday, 9 May 2026 12:15"
    const match = staffTime.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return new Date(`${month} ${day}, ${year} ${hour}:${minute}:00`);
    }
  } catch (e) {
    console.error('Failed to parse staff time:', e);
  }
  return null;
}

function buildReminderEmbed(flight, minutesBefore) {
  return new EmbedBuilder()
    .setTitle('✈️ Flight Reminder')
    .setDescription(`Your flight **${flight.number}** (${flight.from} → ${flight.to}) briefing starts in **${minutesBefore} minutes**!`)
    .addFields({ name: 'Staff Joining', value: flight.staffTime })
    .setColor(0x5865F2)
    .setTimestamp();
}

async function scheduleReminders(client, allocation, minutesBefore = 15) {
  const timeStr = allocation.flight.staffTimeUtc || allocation.flight.staffTime;
  const staffDate = parseStaffTime(timeStr);
  if (!staffDate) {
    console.warn(`Could not parse staff time: ${timeStr}`);
    return;
  }

  const reminderTime = new Date(staffDate.getTime() - minutesBefore * 60 * 1000);
  const now = Date.now();
  const delay = reminderTime.getTime() - now;

  if (delay <= 0) {
    console.log(`Reminder time already passed for flight ${allocation.flight.number}`);
    return;
  }

  console.log(`⏰ Reminder scheduled for ${allocation.flight.number} in ${Math.round(delay / 60000)} minutes`);

  setTimeout(async () => {
    try {
      // Re-fetch allocation to get latest sign-ups
      const Allocation = require('../models/Allocation');
      const latest = await Allocation.findOne({ messageId: allocation.messageId });
      if (!latest) return;

      const allUserIds = new Set([
        ...latest.dispatchCoordinator,
        ...latest.dispatchSupervisor,
        ...latest.captain,
        ...latest.firstOfficer,
        ...latest.cabinCrew,
        ...latest.groundHandling,
        ...latest.purser,
        ...latest.tarmacSupervisor,
      ]);

      const embed = buildReminderEmbed(latest.flight, minutesBefore);

      for (const userId of allUserIds) {
        try {
          const user = await client.users.fetch(userId);
          await user.send({ embeds: [embed] });
        } catch (err) {
          console.warn(`Could not DM user ${userId}:`, err.message);
        }
      }

      console.log(`✅ Sent reminders for flight ${latest.flight.number} to ${allUserIds.size} users`);
    } catch (err) {
      console.error('Error sending reminders:', err);
    }
  }, delay);
}

module.exports = { scheduleReminders, parseStaffTime };
