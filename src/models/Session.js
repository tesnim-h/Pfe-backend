const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    // Public identifier used by API paths.
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    // Learner and teacher are linked by userId (string), not ObjectId.
    // learnerId is empty for public open sessions (no learner until someone joins).
    learnerId: {
      type: String,
      default: '',
      trim: true,
      ref: 'User',
      index: true,
    },
    teacherId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
      index: true,
    },
    // Human-readable session title (used for public sessions).
    title: {
      type: String,
      default: '',
      trim: true,
    },
    // Domain fields requested for session request lifecycle.
    skill: {
      type: String,
      default: '',
      trim: true,
    },
    categoryId: {
      type: String,
      trim: true,
      ref: 'SkillCategory',
      default: '',
    },
    duration: {
      type: Number,
      default: 1,
      min: 1,
    },
    date: {
      type: Date,
      required: true,
    },
    message: {
      type: String,
      default: '',
    },
    // Google Meet link for public open sessions.
    googleMeetLink: {
      type: String,
      default: '',
      trim: true,
    },
    // Credits required to join this session (set by the host).
    sessionCredits: {
      type: Number,
      min: 0,
      default: 0,
    },
    actualDuration: {
      type: Number,
      min: 0.01,
    },
    chargedCredits: {
      type: Number,
      min: 0.01,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'],
      uppercase: true,
      default: 'PENDING',
      index: true,
    },
    // Links a join-request session back to the public session it was created for.
    parentSessionId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    // Marks whether credit transfer already ran for idempotency protection.
    creditsTransferred: {
      type: Boolean,
      default: false,
    },
    // Marks whether teacher XP was granted for this session (1 credit = 10 XP).
    xpAwarded: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

sessionSchema.index({ learnerId: 1, date: -1 });
sessionSchema.index({ teacherId: 1, date: -1 });
sessionSchema.index({ learnerId: 1, status: 1 });
sessionSchema.index({ teacherId: 1, status: 1 });

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
