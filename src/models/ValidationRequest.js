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

module.exports =
  mongoose.models.ValidationRequest ||
  mongoose.model('ValidationRequest', validationRequestSchema);
