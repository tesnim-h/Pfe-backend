const { randomUUID } = require('crypto');

const Challenge = require('../models/Challenge');
const ChallengeEntry = require('../models/ChallengeEntry');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const xpService = require('./xp.service');
const { XP_SOURCES } = require('../constants/xp');

const ADMIN_ROLES = new Set(['ADMIN', 'admin']);

const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  return user;
};

const ensureAdmin = (user) => {
  ensureAuthenticatedUser(user);
  if (!ADMIN_ROLES.has(user.role)) {
    throw new ApiError(403, 'Admin access required', 'FORBIDDEN');
  }
};

const normalizeChallengeId = (id) => {
  const normalized = id?.trim();
  if (!normalized) throw new ApiError(400, 'Challenge id is required', 'VALIDATION_ERROR');
  return normalized;
};

const normalizeEntryId = (id) => {
  const normalized = id?.trim();
  if (!normalized) throw new ApiError(400, 'Entry id is required', 'VALIDATION_ERROR');
  return normalized;
};

const CHALLENGE_TYPES = ['SKILL_SPRINT', 'TEACHING', 'COLLABORATION'];

// Admin creates a new challenge.
const createChallenge = async (currentUser, payload) => {
  ensureAdmin(currentUser);

  const type = String(payload.type || '').trim().toUpperCase();
  if (!CHALLENGE_TYPES.includes(type)) {
    throw new ApiError(400, 'Invalid challenge type', 'VALIDATION_ERROR');
  }

  if (!payload.title?.trim()) {
    throw new ApiError(400, 'Title is required', 'VALIDATION_ERROR');
  }

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new ApiError(400, 'Invalid startDate or endDate', 'VALIDATION_ERROR');
  }

  if (endDate <= startDate) {
    throw new ApiError(400, 'endDate must be after startDate', 'VALIDATION_ERROR');
  }

  const challenge = await Challenge.create({
    challengeId:      `CHL-${randomUUID()}`,
    type,
    title:            payload.title.trim(),
    description:      payload.description?.trim() || '',
    startDate,
    endDate,
    participationXp:  Number(payload.participationXp) || 20,
    winnerXp:         Number(payload.winnerXp) || 80,
    rewardCredits:    Number(payload.rewardCredits) || 0,
    postedBy:         currentUser.userId,
  });

  return challenge.toObject();
};

// Lists challenges visible to all authenticated users.
const listChallenges = async (currentUser, query = {}) => {
  ensureAuthenticatedUser(currentUser);

  const filter = {};
  const status = query.status?.trim().toUpperCase();
  if (status && ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
    filter.status = status;
  }

  const challenges = await Challenge.find(filter).sort({ startDate: -1 }).limit(100).lean();
  return challenges;
};

// Returns a single challenge by challengeId.
const getChallenge = async (currentUser, challengeId) => {
  ensureAuthenticatedUser(currentUser);
  const normalized = normalizeChallengeId(challengeId);

  const challenge = await Challenge.findOne({ challengeId: normalized }).lean();
  if (!challenge) throw new ApiError(404, 'Challenge not found', 'CHALLENGE_NOT_FOUND');

  return challenge;
};

// User submits an entry for an active challenge. Awards +participationXp XP immediately.
const submitEntry = async (currentUser, challengeId, payload = {}) => {
  const user = ensureAuthenticatedUser(currentUser);
  const normalized = normalizeChallengeId(challengeId);

  const challenge = await Challenge.findOne({ challengeId: normalized }).lean();
  if (!challenge) throw new ApiError(404, 'Challenge not found', 'CHALLENGE_NOT_FOUND');

  if (challenge.status !== 'ACTIVE') {
    throw new ApiError(409, 'This challenge is no longer active', 'CHALLENGE_NOT_ACTIVE');
  }

  let entry;
  try {
    entry = await ChallengeEntry.create({
      entryId:       `ENTRY-${randomUUID()}`,
      challengeId:   normalized,
      userId:        user.userId,
      submissionUrl: payload.submissionUrl?.trim() || '',
      notes:         payload.notes?.trim() || '',
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'You have already submitted an entry for this challenge', 'DUPLICATE_ENTRY');
    }
    throw err;
  }

  // Award participation XP (+20 XP per spec) — non-blocking.
  try {
    await xpService.addXP(
      user.userId,
      challenge.participationXp,
      XP_SOURCES.CHALLENGE_PARTICIPATION,
      { description: `Challenge participation: ${challenge.title}` }
    );
    entry.participationXpAwarded = true;
    await entry.save();
  } catch (_) {
    // Non-blocking.
  }

  return entry.toObject();
};

// Admin marks entries as winners. Awards +winnerXp XP to each winner.
// winnerEntryIds: array of entryId strings (up to 3 per spec).
const pickWinners = async (currentUser, challengeId, winnerEntryIds = []) => {
  ensureAdmin(currentUser);
  const normalized = normalizeChallengeId(challengeId);

  const challenge = await Challenge.findOne({ challengeId: normalized });
  if (!challenge) throw new ApiError(404, 'Challenge not found', 'CHALLENGE_NOT_FOUND');

  if (!Array.isArray(winnerEntryIds) || winnerEntryIds.length === 0) {
    throw new ApiError(400, 'At least one entry id is required', 'VALIDATION_ERROR');
  }

  const results = [];

  for (const entryId of winnerEntryIds) {
    const normalizedEntryId = normalizeEntryId(entryId);
    const entry = await ChallengeEntry.findOne({ entryId: normalizedEntryId, challengeId: normalized });

    if (!entry) continue;

    if (entry.status !== 'WINNER') {
      entry.status = 'WINNER';
      await entry.save();
    }

    if (!entry.winnerXpAwarded) {
      try {
        await xpService.addXP(
          entry.userId,
          challenge.winnerXp,
          XP_SOURCES.CHALLENGE_WINNER,
          { description: `Challenge winner: ${challenge.title}` }
        );
        entry.winnerXpAwarded = true;
        await entry.save();
      } catch (_) {
        // Non-blocking.
      }
    }

    results.push(entry.toObject());
  }

  return results;
};

// Admin closes a challenge (marks it COMPLETED).
const closeChallenge = async (currentUser, challengeId) => {
  ensureAdmin(currentUser);
  const normalized = normalizeChallengeId(challengeId);

  const challenge = await Challenge.findOne({ challengeId: normalized });
  if (!challenge) throw new ApiError(404, 'Challenge not found', 'CHALLENGE_NOT_FOUND');

  challenge.status = 'COMPLETED';
  await challenge.save();

  return challenge.toObject();
};

// Returns all entries for a challenge, filtered to the caller's level tier.
const getChallengeLeaderboard = async (currentUser, challengeId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const normalized = normalizeChallengeId(challengeId);

  const challenge = await Challenge.findOne({ challengeId: normalized }).lean();
  if (!challenge) throw new ApiError(404, 'Challenge not found', 'CHALLENGE_NOT_FOUND');

  const entries = await ChallengeEntry.find({ challengeId: normalized })
    .sort({ submittedAt: 1 })
    .lean();

  const userIds = entries.map((e) => e.userId);
  const callerLevel = user.level || 1;

  const users = await User.find({ userId: { $in: userIds }, level: callerLevel })
    .select('userId firstName lastName level levelTitle')
    .lean();

  const userMap = new Map(users.map((u) => [u.userId, u]));

  const leaderboard = entries
    .filter((e) => userMap.has(e.userId))
    .map((e, index) => {
      const u = userMap.get(e.userId);
      return {
        rank:          index + 1,
        entryId:       e.entryId,
        userId:        e.userId,
        displayName:   [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Unknown',
        status:        e.status,
        submittedAt:   e.submittedAt,
        isCurrentUser: e.userId === user.userId,
      };
    });

  return {
    challengeId: normalized,
    challenge: { title: challenge.title, type: challenge.type, status: challenge.status },
    level: callerLevel,
    entries: leaderboard,
  };
};

module.exports = {
  createChallenge,
  listChallenges,
  getChallenge,
  submitEntry,
  pickWinners,
  closeChallenge,
  getChallengeLeaderboard,
};
