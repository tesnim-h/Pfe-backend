const mongoose = require('mongoose');

const challengeEntrySchema = new mongoose.Schema(
  {
    entryId:     { type: String, required: true, unique: true, index: true, trim: true },
    challengeId: { type: String, required: true, trim: true, ref: 'Challenge', index: true },
    userId:      { type: String, required: true, trim: true, ref: 'User', index: true },
    submissionUrl: { type: String, default: '', trim: true },
    notes:         { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['SUBMITTED', 'WINNER'],
      default: 'SUBMITTED',
    },
    participationXpAwarded: { type: Boolean, default: false },
    winnerXpAwarded:        { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// One submission per user per challenge.
challengeEntrySchema.index({ challengeId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.ChallengeEntry || mongoose.model('ChallengeEntry', challengeEntrySchema);
