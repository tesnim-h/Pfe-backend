const mongoose = require('mongoose');

const projectMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    ownerId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
    },
    categoryId: {
      type: String,
      trim: true,
      ref: 'SkillCategory',
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    requiredSkill: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      uppercase: true,
      default: 'OPEN',
    },
    members: {
      type: [projectMemberSchema],
      default: [],
    },
    joinRequests: {
      type: [
        new mongoose.Schema(
          {
            userId: {
              type: String,
              required: true,
              trim: true,
              ref: 'User',
            },
            requestedAt: {
              type: Date,
              default: Date.now,
            },
          },
          { _id: false }
        ),
      ],
      default: [],
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

projectSchema.index({ ownerId: 1, createdAt: -1 });
projectSchema.index({ categoryId: 1, createdAt: -1 });
projectSchema.index({ status: 1, createdAt: -1 });
projectSchema.index({ 'members.userId': 1 });
projectSchema.index({ 'joinRequests.userId': 1 });

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
