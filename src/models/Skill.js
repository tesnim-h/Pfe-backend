const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    skillId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
    },
    categoryId: {
      type: String,
      required: true,
      trim: true,
      ref: 'SkillCategory',
    },
    skillName: {
      type: String,
      required: true,
      trim: true,
    },
    proficiencyLevel: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
      uppercase: true,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
      min: 0,
    },
    selfDeclared: {
      type: Boolean,
      default: false,
    },
    validationStatus: {
      type: String,
      enum: ['UNVALIDATED', 'PENDING', 'VALIDATED'],
      uppercase: true,
      default: 'UNVALIDATED',
    },
    validationScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    validatedBy: {
      type: String,
      trim: true,
      ref: 'User',
    },
    validatedAt: {
      type: Date,
    },
    // Skill Tier — mentor-assigned during validation. Drives S multiplier in Credits = T × S × M.
    skillTier: {
      type: String,
      enum: ['STARTER', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
      uppercase: true,
      default: 'STARTER',
    },
    skillTierMultiplier: {
      type: Number,
      default: 1.0,
      min: 1.0,
    },
    // Trust Score — per-skill reputation signal (0–100). Formula: round(0.55×P + 0.45×E).
    trustScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    trustBadge: {
      type: String,
      enum: ['UNVERIFIED', 'BRONZE', 'SILVER', 'GOLD', 'VERIFIED'],
      uppercase: true,
      default: 'UNVERIFIED',
    },
    // M modifier applied in Credits = T × S × M (derived from trustBadge).
    trustModifier: {
      type: Number,
      default: 1.0,
      min: 1.0,
    },
    portfolioScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    endorsementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    endorsementCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

skillSchema.index({ userId: 1 });
skillSchema.index({ validationStatus: 1 });
skillSchema.index({ userId: 1, validationStatus: 1 });

module.exports = mongoose.models.Skill || mongoose.model('Skill', skillSchema);