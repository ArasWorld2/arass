const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  flight: {
    number: String,
    from: String,
    to: String,
    staffTime: String,
    passengerTime: String,
    aircraft: String,
    date: String,
  },
  // Each role stores array of user IDs
  dispatchCoordinator: { type: [String], default: [] },
  dispatchSupervisor:  { type: [String], default: [] },
  captain:             { type: [String], default: [] },
  firstOfficer:        { type: [String], default: [] },
  cabinCrew:           { type: [String], default: [] },
  groundHandling:      { type: [String], default: [] },
  purser:              { type: [String], default: [] },
  tarmacSupervisor:    { type: [String], default: [] },
  // Queues for full roles
  queues: {
    dispatchCoordinator: { type: [String], default: [] },
    dispatchSupervisor:  { type: [String], default: [] },
    captain:             { type: [String], default: [] },
    firstOfficer:        { type: [String], default: [] },
    cabinCrew:           { type: [String], default: [] },
    groundHandling:      { type: [String], default: [] },
    purser:              { type: [String], default: [] },
    tarmacSupervisor:    { type: [String], default: [] },
  },
}, { timestamps: true });

module.exports = mongoose.model('Allocation', allocationSchema);
