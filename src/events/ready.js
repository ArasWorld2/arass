const { Events, ActivityType } = require('discord.js');
const { startCalendarLoop } = require('../utils/calendar.js');
const { checkLoaSchedules } = require('../utils/loaRunner');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    client.user.setActivity('LOT Operations', { type: ActivityType.Watching });

    // Start the 5-minute calendar timetable loop (runs immediately once on startup)
    try {
      startCalendarLoop(client);
    } catch (err) {
      console.error('Failed to start calendar loop:', err);
    }

    // Run initial LOA schedule check on startup
    try {
      await checkLoaSchedules(client);
    } catch (err) {
      if (err.code === 50001 || err.code === 10003) {
        console.warn('[Engine Bypass] Skipped initial LOA startup run due to hidden or deleted channel permissions.');
      } else {
        console.error('Initial LOA background check error:', err);
      }
    }

    // Automated LOA schedule scan every 10 minutes
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
