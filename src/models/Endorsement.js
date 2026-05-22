const mongoose = require('mongoose');

// One endorsement = one confirmed collaborator vouching for a skill on a completed project.
// CRITICAL: fromUserId and toUserId must both be members of a COMPLETED project.
// Enforced at service level; the unique index prevents duplicate endorsements per (from,to,project,skill).
const endorsementSchema = new mongoose.Schema(
  {
    endorsementId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    fromUserId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
    },
    toUserId: {
      type: String,
      required: true,
      trim: true,
      ref: 'User',
    },
    skillId: {
      type: String,
      required: true,
      trim: true,
      ref: 'Skill',
    },
    projectId: {
      type: String,
      required: true,
      trim: true,
      ref: 'Project',
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

// One endorsement per (endorser, recipient, project, skill) — cannot endorse the same person twice for the same project+skill.
endorsementSchema.index({ fromUserId: 1, toUserId: 1, projectId: 1, skillId: 1 }, { unique: true });
endorsementSchema.index({ toUserId: 1, skillId: 1 });
endorsementSchema.index({ projectId: 1 });

module.exports =
  mongoose.models.Endorsement || mongoose.model('Endorsement', endorsementSchema);
