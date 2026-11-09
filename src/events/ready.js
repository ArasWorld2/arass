const { Events, ActivityType } = require('discord.js');
const { updateCalendar, checkUpcomingDepartures } = require('../utils/calendar.js');
const { checkLoaSchedules } = require('../utils/loaRunner');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Updated default status activity
    client.user.setActivity('LOT Operations', { type: ActivityType.Watching });

    // Run loops immediately when bot turns on with a safety wrapper
    try {
      await updateCalendar(client);
      await checkUpcomingDepartures(client);
      await checkLoaSchedules(client);
    } catch (err) {
      if (err.code === 50001 || err.code === 10003) {
        console.warn('[Engine Bypass] Skipped initial startup run due to hidden or deleted channel permissions.');
      } else {
        console.error('Initial background check error:', err);
      }
    }

    // Runs every 10 seconds. Ultra fast updates without hitting rate-limits!
    setInterval(async () => {
      try {
        await updateCalendar(client);
        await checkUpcomingDepartures(client);
      } catch (err) {
        if (err.code === 50001 || err.code === 10003) {
          return;
        }
        console.error('Error running departures alert engine:', err);
      }
    }, 10 * 1000); 

    // Automated LOA schedule runner checking for start/expire entries every 10 minutes
    setInterval(async () => {
      try {
        console.log('[LOA Engine] Running automated schedule scan...');
        await checkLoaSchedules(client);
      } catch (err) {
        console.error('Error running automated LOA cycle check:', err);
      }
    }, 10 * 60 * 1000);
  },
};
};
