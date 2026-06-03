const { updateCalendar, checkUpcomingDepartures } = require('../utils/calendar.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('Flight Operations', { type: 3 }); // 3 = Watching

    // Run loops immediately when bot turns on
    try {
      await updateCalendar(client);
      await checkUpcomingDepartures(client);
    } catch (err) {
      console.error('Initial background check error:', err);
    }

    // CRITICAL FIX: Runs every 10 seconds. Ultra fast updates without hitting rate-limits!
    setInterval(async () => {
      await updateCalendar(client);
      await checkUpcomingDepartures(client);
    }, 10 * 1000); 
  },
};