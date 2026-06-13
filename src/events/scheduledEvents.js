const { updateCalendar } = require('../utils/calendar');

module.exports = [
  {
    name: 'guildScheduledEventCreate',
    async execute(event, client) {
      await updateCalendar(client);
    },
  },
  {
    name: 'guildScheduledEventUpdate',
    async execute(oldEvent, newEvent, client) {
      await updateCalendar(client);
    },
  },
  {
    name: 'guildScheduledEventDelete',
    async execute(event, client) {
      await updateCalendar(client);
    },
  },
];
