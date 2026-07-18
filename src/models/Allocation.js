const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  flight: {
    number: String,
    from: String,
    to: String,
    staffTime: String,
    staffTimeUtc: String,
    passengerTime: String,
    aircraft: String,
    date: String,
    gate: String,
    boardingTime: String,
    operationsClosure: String,
  },
  
  // 🔒 This line preserves the lock state toggled by /allocation-lock
  isLocked: { type: Boolean, default: false },

  dispatchSupervisor:  { type: [String], default: [] },
  flightSupervisor:    { type: [String], default: [] },
  captain:             { type: [String], default: [] },
  firstOfficer:        { type: [String], default: [] },
  purser:              { type: [String], default: [] },
  cabinCrew:           { type: [String], default: [] },
  groundHandling:      { type: [String], default: [] },
  tarmacSupervisor:    { type: [String], default: [] },
  dispatchCoordinator: { type: [String], default: [] },
  bagDropAgent:        { type: [String], default: [] },
  gateAgent:           { type: [String], default: [] },
  loungeAttendant:     { type: [String], default: [] },
  queues: {
    dispatchSupervisor:  { type: [String], default: [] },
    flightSupervisor:    { type: [String], default: [] },
    captain:             { type: [String], default: [] },
    firstOfficer:        { type: [String], default: [] },
    purser:              { type: [String], default: [] },
    cabinCrew:           { type: [String], default: [] },
    groundHandling:      { type: [String], default: [] },
    tarmacSupervisor:    { type: [String], default: [] },
    dispatchCoordinator: { type: [String], default: [] },
    bagDropAgent:        { type: [String], default: [] },
    gateAgent:           { type: [String], default: [] },
    loungeAttendant:     { type: [String], default: [] },
  },
}, { timestamps: true });

module.exports = mongoose.model('Allocation', allocationSchema);