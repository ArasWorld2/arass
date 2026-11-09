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
  
  // 🔒 Lock state toggled by /allocation-lock
  isLocked: { type: Boolean, default: false },

  // 🎲 Flight Deck Lottery Pool Fields
  cptPool:           { type: [String], default: [] },
  foPool:            { type: [String], default: [] },
  fdChoiceMessageId: { type: String, default: null },

  // ==========================================
  // ROLE ALLOCATIONS (Full Schema Names & Short Keys)
  // ==========================================
  // Flight Management
  dc:                  { type: [String], default: [] },
  dispatchCoordinator: { type: [String], default: [] },
  mb:                  { type: [String], default: [] },
  dispatchSupervisor:  { type: [String], default: [] },
  flightSupervisor:    { type: [String], default: [] },
  managementBoard:     { type: [String], default: [] },

  // Flight Deck
  cpt:               { type: [String], default: [] },
  captain:           { type: [String], default: [] },
  fo:                { type: [String], default: [] },
  firstOfficer:      { type: [String], default: [] },
  stbyFd:            { type: [String], default: [] },
  standbyFlightDeck: { type: [String], default: [] },

  // Cabin Crew
  purser:           { type: [String], default: [] },
  cc:               { type: [String], default: [] },
  cabinCrew:        { type: [String], default: [] },
  stbyCc:           { type: [String], default: [] },
  standbyCabinCrew: { type: [String], default: [] },

  // Ground Crew
  ts:               { type: [String], default: [] },
  tarmacSupervisor: { type: [String], default: [] },
  gc:               { type: [String], default: [] },
  groundHandling:   { type: [String], default: [] },
  groundCrew:       { type: [String], default: [] },
  stbyGc:           { type: [String], default: [] },
  standbyGroundCrew: { type: [String], default: [] },

  // Airport Worker
  bcbd:                 { type: [String], default: [] },
  businessClassBagDrop: { type: [String], default: [] },
  ecbd:                 { type: [String], default: [] },
  economyClassBagDrop:  { type: [String], default: [] },
  bagDropAgent:         { type: [String], default: [] },
  cs:                   { type: [String], default: [] },
  customerService:      { type: [String], default: [] },
  gate:                 { type: [String], default: [] },
  gateAgent:            { type: [String], default: [] },
  lounge:               { type: [String], default: [] },
  loungeAttendant:      { type: [String], default: [] },

  // ==========================================
  // QUEUES (Nested Schema Definition)
  // ==========================================
  queues: {
    dc:                  { type: [String], default: [] },
    dispatchCoordinator: { type: [String], default: [] },
    mb:                  { type: [String], default: [] },
    dispatchSupervisor:  { type: [String], default: [] },
    flightSupervisor:    { type: [String], default: [] },
    cpt:                 { type: [String], default: [] },
    captain:             { type: [String], default: [] },
    fo:                  { type: [String], default: [] },
    firstOfficer:        { type: [String], default: [] },
    stbyFd:              { type: [String], default: [] },
    purser:              { type: [String], default: [] },
    cc:                  { type: [String], default: [] },
    cabinCrew:           { type: [String], default: [] },
    stbyCc:              { type: [String], default: [] },
    ts:                  { type: [String], default: [] },
    tarmacSupervisor:    { type: [String], default: [] },
    gc:                  { type: [String], default: [] },
    groundHandling:      { type: [String], default: [] },
    stbyGc:              { type: [String], default: [] },
    bcbd:                { type: [String], default: [] },
    ecbd:                { type: [String], default: [] },
    bagDropAgent:        { type: [String], default: [] },
    cs:                  { type: [String], default: [] },
    gate:                { type: [String], default: [] },
    gateAgent:           { type: [String], default: [] },
    lounge:              { type: [String], default: [] },
    loungeAttendant:     { type: [String], default: [] },
  },
}, { 
  timestamps: true,
  strict: false // Flexible schema persistence
});

module.exports = mongoose.model('Allocation', allocationSchema);
