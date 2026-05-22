const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    challengeId: { type: String, required: true, unique: true, index: true, trim: true },
    type: {
      type: String,
      enum: ['SKILL_SPRINT', 'TEACHING', 'COLLABORATION'],
      required: true,
    },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
    },
    // XP awarded to every participant who submits (+20 XP per spec).
    participationXp: { type: Number, default: 20, min: 0 },
    // XP awarded to top-3 winners (+80 XP per spec).
    winnerXp: { type: Number, default: 80, min: 0 },
    // Credit bonus for TEACHING challenge type (+credits per spec).
    rewardCredits: { type: Number, default: 0, min: 0 },
    postedBy: { type: String, required: true, trim: true, ref: 'User' },
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

challengeSchema.index({ status: 1, startDate: -1 });

module.exports = mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
