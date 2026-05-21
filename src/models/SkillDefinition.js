const mongoose = require('mongoose');

const skillDefinitionSchema = new mongoose.Schema(
  {
    skillDefinitionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    skillName: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: String,
      required: true,
      trim: true,
      ref: 'SkillCategory',
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  }
);

skillDefinitionSchema.index({ categoryId: 1, skillName: 1 });
skillDefinitionSchema.index({ isActive: 1 });

module.exports =
  mongoose.models.SkillDefinition ||
  mongoose.model('SkillDefinition', skillDefinitionSchema);
