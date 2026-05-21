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