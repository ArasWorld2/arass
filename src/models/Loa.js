const mongoose = require('mongoose');

const loaSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'DENIED', 'EXPIRED'], default: 'PENDING' },
    roleApplied: { type: Boolean, default: false },
    roleRemoved: { type: Boolean, default: false },
    reviewMessageId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Loa', loaSchema);