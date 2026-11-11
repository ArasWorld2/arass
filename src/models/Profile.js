const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // Discord User ID
    robloxUsername: { type: String, required: true },
    robloxId: { type: String, required: true },
    flightPoints: { type: Number, default: 0 },
    hostPoints: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    rank: { type: String, default: 'Flight Crew' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Profile', profileSchema);
