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
    default: 'user',
  },
  accountStatus: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'BANNED'],
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
  passwordResetToken: { 
    type: String, select: false 
  },
  passwordResetExpires: { 
    type: Date, select: false 
  },

});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
