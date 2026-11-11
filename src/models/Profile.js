const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    robloxUsername: { type: String, required: true },
    robloxId: { type: String, required: true },
    rank: { type: String, default: 'Flight Crew' },
    flightPoints: { type: Number, default: 0 },
    hostPoints: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
