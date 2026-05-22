const mongoose = require('mongoose');

const mentoringRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    skillId: {
      type: String,
      required: true,
      trim: true,
      ref: 'Skill',
    },
    learnerUserId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
    },
    requestStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      uppercase: true,
      default: 'PENDING',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
    },
    reviewedBy: {
      type: String,
      default: '',
      trim: true,
      ref: 'User',
    },
    portfolioLink: {
      type: String,
      default: '',
      trim: true,
    },
    proofFileName: {
      type: String,
      default: '',
      trim: true,
    },
    proofStoredName: {
      type: String,
      default: '',
      trim: true,
    },
    proofMimeType: {
      type: String,
      default: '',
      trim: true,
    },
    requestNote: {
      type: String,
      default: '',
    },
    approvalScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    approvalFeedback: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
  },
  {
    versionKey: false,
  }
);

mentoringRequestSchema.index({ learnerUserId: 1 });
mentoringRequestSchema.index({ requestStatus: 1 });
mentoringRequestSchema.index({ learnerUserId: 1, requestStatus: 1 });

module.exports =
  mongoose.models.MentoringRequest ||
  mongoose.model('MentoringRequest', mentoringRequestSchema);
