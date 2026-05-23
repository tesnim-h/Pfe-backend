const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  profilePicture: {
    type: String,
    trim: true,
  },
  bio: {
    type: String,
  },
  portfolioUrl: {
    type: String,
    trim: true,
    default: '',
  },
  resumeFileName: {
    type: String,
    trim: true,
    default: '',
  },
  resumeStoredName: {
    type: String,
    trim: true,
    default: '',
  },
  resumeMimeType: {
    type: String,
    trim: true,
    default: '',
  },
  resumeUploadedAt: {
    type: Date,
  },
  countryId: {
    type: String,
    trim: true,
    ref: 'Country',
  },
  cityId: {
    type: String,
    trim: true,
    ref: 'City',
  },
  languages: {
    type: [String],
    default: [],
  },
  offeredSkills: {
    type: [String],
    default: [],
  },
  wantedSkills: {
    type: [String],
    default: [],
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'LEARNER', 'MENTOR', 'ADMIN'],
    default: 'LEARNER',
  },
  accountStatus: {
    type: String,
    enum: ['ACTIVE', 'BANNED'],
    uppercase: true,
    default: 'ACTIVE',
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
  timeCredits: {
    type: mongoose.Schema.Types.Decimal128,
    default: () => mongoose.Types.Decimal128.fromString('0'),
  },
  // Global reputation XP (never spendable; separate from credits).
  xpTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 6,
  },
  levelTitle: {
    type: String,
    default: 'Seed',
    trim: true,
  },
  xpHistory: {
    type: [
      {
        amount: { type: Number, required: true, min: 1 },
        source: { type: String, required: true, trim: true },
        sessionId: { type: String, trim: true, default: null },
        description: { type: String, trim: true, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
  lastXpGainAt: {
    type: Date,
  },
  passwordResetToken: {
    type: String, select: false
  },
  passwordResetExpires: {
    type: Date, select: false
  },

  // Gamification — earned badges (permanent, public).
  badges: {
    type: [
      {
        key: { type: String, required: true, trim: true },
        awardedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
    _id: false,
  },

  // Streak system — consecutive days of qualifying activity.
  currentStreak:    { type: Number, default: 0, min: 0 },
  longestStreak:    { type: Number, default: 0, min: 0 },
  lastActivityDate: { type: Date, default: null },
  // Streak shield: once per calendar month, one missed day does not break the streak.
  streakShieldUsedAt: { type: Date, default: null },

});

userSchema.index({ accountStatus: 1 });
userSchema.index({ role: 1 });
userSchema.index({ accountStatus: 1, role: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
