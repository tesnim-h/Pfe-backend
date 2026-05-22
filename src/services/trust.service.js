const { randomUUID } = require('crypto');

const Endorsement = require('../models/Endorsement');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const SkillEvidence = require('../models/SkillEvidence');
const ApiError = require('../utils/ApiError');
const badgeService = require('./badge.service');
const streakService = require('./streak.service');
const {
  getTrustBadge,
  computeTrustScore,
  computePortfolioScore,
  computeEndorsementScore,
  PLATFORM_EVIDENCE_TYPES,
  ACTIVE_CONTENT_TYPES,
} = require('../constants/trust');

// Derives P score inputs from evidence linked to a skill.
const buildPortfolioInputs = async (userId, skillId) => {
  const evidenceItems = await SkillEvidence.find({ skillId }).lean();

  const platformTypes = new Set(
    evidenceItems
      .map((e) => e.evidenceType)
      .filter((t) => PLATFORM_EVIDENCE_TYPES.has(t))
  );

  const hasActiveContent = evidenceItems.some((e) => ACTIVE_CONTENT_TYPES.has(e.evidenceType));

  // Count completed Fenneky projects where user is owner or member.
  const fennekyProjects = await Project.countDocuments({
    status: 'COMPLETED',
    $or: [{ ownerId: userId }, { 'members.userId': userId }],
  });

  return {
    platformCount: platformTypes.size,
    hasActiveContent,
    fennekyProjectCount: fennekyProjects,
  };
};

// Recomputes trust score for a specific skill and saves it to the Skill document.
// Called after any event that could change P or E: evidence added, endorsement granted, validation received.
const recomputeSkillTrust = async (userId, skillId, mongoSession = null) => {
  const queryOptions = mongoSession ? { session: mongoSession } : {};
  const skill = await Skill.findOne({ skillId, userId }, null, queryOptions);

  if (!skill) {
    throw new ApiError(404, 'Skill not found', 'SKILL_NOT_FOUND');
  }

  const [portfolioInputs, endorsementCount] = await Promise.all([
    buildPortfolioInputs(userId, skillId),
    Endorsement.countDocuments({ toUserId: userId, skillId }),
  ]);

  const portfolioScore = computePortfolioScore(portfolioInputs);
  const endorsementScoreValue = computeEndorsementScore(endorsementCount);
  const trustScore = computeTrustScore(portfolioScore, endorsementScoreValue);
  const { badge, modifier } = getTrustBadge(trustScore);

  skill.portfolioScore = portfolioScore;
  skill.endorsementScore = endorsementScoreValue;
  skill.endorsementCount = endorsementCount;
  skill.trustScore = trustScore;
  skill.trustBadge = badge;
  skill.trustModifier = modifier;
  skill.lastUpdated = new Date();

  await skill.save(queryOptions);

  // Check validation badges whenever trust score changes — fire-and-forget.
  if (!mongoSession) {
    badgeService.checkValidationBadges(userId).catch(() => {});
  }

  return {
    skillId,
    portfolioScore,
    endorsementScore: endorsementScoreValue,
    endorsementCount,
    trustScore,
    trustBadge: badge,
    trustModifier: modifier,
  };
};

// Returns the current trust profile for a skill without writing to DB.
const getSkillTrustProfile = async (userId, skillId) => {
  const skill = await Skill.findOne({ skillId, userId }).lean();

  if (!skill) {
    throw new ApiError(404, 'Skill not found', 'SKILL_NOT_FOUND');
  }

  return {
    skillId: skill.skillId,
    skillName: skill.skillName,
    skillTier: skill.skillTier,
    skillTierMultiplier: skill.skillTierMultiplier,
    trustScore: skill.trustScore,
    trustBadge: skill.trustBadge,
    trustModifier: skill.trustModifier,
    portfolioScore: skill.portfolioScore,
    endorsementScore: skill.endorsementScore,
    endorsementCount: skill.endorsementCount,
  };
};

// Returns trust profile for a specific skill by userId — for public profile display.
const getPublicSkillTrustProfiles = async (userId) => {
  const skills = await Skill.find({
    userId,
    validationStatus: 'VALIDATED',
  })
    .select('skillId skillName skillTier skillTierMultiplier trustScore trustBadge trustModifier endorsementCount')
    .lean();

  return skills.map((s) => ({
    skillId: s.skillId,
    skillName: s.skillName,
    skillTier: s.skillTier,
    skillTierMultiplier: s.skillTierMultiplier,
    trustScore: s.trustScore,
    trustBadge: s.trustBadge,
    trustModifier: s.trustModifier,
    endorsementCount: s.endorsementCount,
  }));
};

// Grants an endorsement from one collaborator to another for a specific skill.
// Gate: both users must be members (or owner) of a COMPLETED project.
const grantEndorsement = async (fromUser, { toUserId, skillId, projectId }) => {
  if (!fromUser?.userId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const fromUserId = fromUser.userId;

  if (fromUserId === toUserId) {
    throw new ApiError(400, 'You cannot endorse yourself', 'VALIDATION_ERROR');
  }

  // Verify project is COMPLETED and both users are real participants.
  const project = await Project.findOne({ projectId }).lean();

  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.status !== 'COMPLETED') {
    throw new ApiError(
      409,
      'Endorsements are only allowed on completed projects',
      'PROJECT_NOT_COMPLETED'
    );
  }

  const isParticipant = (userId) => {
    return (
      project.ownerId === userId ||
      (project.members || []).some((m) => m.userId === userId)
    );
  };

  if (!isParticipant(fromUserId)) {
    throw new ApiError(403, 'You are not a participant of this project', 'FORBIDDEN');
  }

  if (!isParticipant(toUserId)) {
    throw new ApiError(403, 'The recipient is not a participant of this project', 'FORBIDDEN');
  }

  // Verify the skill belongs to the recipient.
  const skill = await Skill.findOne({ skillId, userId: toUserId });

  if (!skill) {
    throw new ApiError(404, 'Skill not found for this user', 'SKILL_NOT_FOUND');
  }

  // Create endorsement (unique index will reject duplicates).
  try {
    await Endorsement.create({
      endorsementId: `END-${randomUUID()}`,
      fromUserId,
      toUserId,
      skillId,
      projectId,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(
        409,
        'You have already endorsed this person for this skill on this project',
        'DUPLICATE_ENDORSEMENT'
      );
    }
    throw err;
  }

  // Recompute trust score for the recipient's skill.
  const updatedTrust = await recomputeSkillTrust(toUserId, skillId);

  // Fire-and-forget: badges + streak for endorser and recipient.
  Promise.all([
    badgeService.checkValidationBadges(toUserId),
    streakService.recordActivity(fromUserId),
  ]).catch(() => {});

  return updatedTrust;
};

// Returns all endorsements a user has received, grouped by skill.
const getReceivedEndorsements = async (userId) => {
  const endorsements = await Endorsement.find({ toUserId: userId })
    .sort({ createdAt: -1 })
    .lean();

  return endorsements.map((e) => ({
    endorsementId: e.endorsementId,
    fromUserId: e.fromUserId,
    skillId: e.skillId,
    projectId: e.projectId,
    createdAt: e.createdAt,
  }));
};

// Returns completed projects where both fromUser and a given toUser are participants.
// Used by frontend to show which projects can unlock the endorse button.
const getEndorsableProjects = async (fromUserId, toUserId) => {
  const projects = await Project.find({
    status: 'COMPLETED',
    $or: [{ ownerId: fromUserId }, { 'members.userId': fromUserId }],
  }).lean();

  return projects.filter(
    (p) =>
      p.ownerId === toUserId || (p.members || []).some((m) => m.userId === toUserId)
  );
};

module.exports = {
  recomputeSkillTrust,
  getSkillTrustProfile,
  getPublicSkillTrustProfiles,
  grantEndorsement,
  getReceivedEndorsements,
  getEndorsableProjects,
};
