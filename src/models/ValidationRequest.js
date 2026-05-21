const mongoose = require('mongoose');

const validationRequestSchema = new mongoose.Schema(
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
    mentorUserId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
    },
    requestStatus: {
      type: String,
      enum: ['PENDING', 'IN_REVIEW', 'VALIDATED', 'REJECTED'],
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
    validationScore: {
      type: Number,
      default: 0,
      min: 0,
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
    validationFeedback: {
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

validationRequestSchema.index({ learnerUserId: 1 });
validationRequestSchema.index({ mentorUserId: 1 });
validationRequestSchema.index({ requestStatus: 1 });
validationRequestSchema.index({ learnerUserId: 1, requestStatus: 1 });

module.exports =
  mongoose.models.ValidationRequest ||
  mongoose.model('ValidationRequest', validationRequestSchema);
