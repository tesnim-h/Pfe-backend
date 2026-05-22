const Project = require('../models/Project');
const Rating = require('../models/Rating');
const Session = require('../models/Session');
const Skill = require('../models/Skill');
const User = require('../models/User');
const { BADGES } = require('../constants/badges');

// Grants a badge to a user — idempotent, safe to call multiple times.
// Returns the badge key if newly granted, null if the user already had it.
const grantBadge = async (userId, badgeKey) => {
  if (!BADGES[badgeKey]) return null;

  const result = await User.findOneAndUpdate(
    { userId, 'badges.key': { $ne: badgeKey } },
    { $push: { badges: { key: badgeKey, awardedAt: new Date() } } },
    { new: true }
  );

  return result ? badgeKey : null;
};

// Checks and grants all teaching badges after a session is confirmed complete.
const checkTeachingBadges = async (teacherId) => {
  const sessionCount = await Session.countDocuments({ teacherId, status: 'COMPLETED' });

  if (sessionCount >= 1)   await grantBadge(teacherId, 'FIRST_SESSION');
  if (sessionCount >= 10)  await grantBadge(teacherId, 'CONSISTENT_MENTOR');
  if (sessionCount >= 50)  await grantBadge(teacherId, 'COMMUNITY_PILLAR');
  if (sessionCount >= 100) await grantBadge(teacherId, 'OASIS_MAKER');

  // TRUSTED_TEACHER requires 25+ sessions AND a 4.5+ average rating.
  if (sessionCount >= 25) {
    const ratingAgg = await Rating.aggregate([
      { $match: { toUser: teacherId } },
      { $group: { _id: null, avg: { $avg: '$score' } } },
    ]);
    if ((ratingAgg[0]?.avg ?? 0) >= 4.5) {
      await grantBadge(teacherId, 'TRUSTED_TEACHER');
    }
  }
};

// Checks and grants all project badges after a project becomes COMPLETED or user joins a project.
const checkProjectBadges = async (userId) => {
  const completedProjects = await Project.find(
    {
      status: 'COMPLETED',
      $or: [{ ownerId: userId }, { 'members.userId': userId }],
    },
    'ownerId members categoryId'
  ).lean();

  const count = completedProjects.length;

  if (count >= 1)  await grantBadge(userId, 'FIRST_BUILD');
  if (count >= 3)  await grantBadge(userId, 'TEAM_PLAYER');
  if (count >= 10) await grantBadge(userId, 'SERIAL_BUILDER');

  // PROJECT_LEADER: owns a completed project that has at least 1 member.
  const hasLed = completedProjects.some(
    (p) => p.ownerId === userId && (p.members || []).length > 0
  );
  if (hasLed) await grantBadge(userId, 'PROJECT_LEADER');

  // CROSS_DISCIPLINARY: 3+ distinct skill categories across completed projects.
  const distinctCategories = new Set(
    completedProjects.map((p) => p.categoryId).filter(Boolean)
  );
  if (distinctCategories.size >= 3) await grantBadge(userId, 'CROSS_DISCIPLINARY');
};

// Checks and grants all validation/trust badges for a user.
// Called after a skill is validated or a trust score is recomputed.
const checkValidationBadges = async (userId) => {
  const validatedSkills = await Skill.find({ userId, validationStatus: 'VALIDATED' }).lean();

  if (validatedSkills.length >= 1) await grantBadge(userId, 'FIRST_VALIDATION');

  const maxTrustScore = Math.max(...validatedSkills.map((s) => s.trustScore || 0), 0);

  if (maxTrustScore >= 25) await grantBadge(userId, 'BRONZE_EARNER');
  if (maxTrustScore >= 50) await grantBadge(userId, 'SILVER_EARNER');
  if (maxTrustScore >= 75) await grantBadge(userId, 'GOLD_EARNER');
  if (maxTrustScore >= 90) await grantBadge(userId, 'FULLY_VERIFIED');
};

module.exports = { grantBadge, checkTeachingBadges, checkProjectBadges, checkValidationBadges };
