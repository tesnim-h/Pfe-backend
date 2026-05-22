const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const CreditTransaction = require('../models/CreditTransaction');
const MentorSkill = require('../models/MentorSkill');
const Session = require('../models/Session');
const Skill = require('../models/Skill');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const creditService = require('./credit.service');
const xpService = require('./xp.service');
const badgeService = require('./badge.service');
const streakService = require('./streak.service');
const { ensureTeacherCanTeachSkill } = require('./validation.service');
const {
  MAX_SESSION_HOURS,
  PROBATION_WEEKLY_CAP_CR,
  PROBATION_BADGE,
} = require('../constants/trust');

const SESSION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'AWAITING_CONFIRMATION', 'COMPLETED'];
const SESSION_ROLES = ['TEACHER', 'LEARNER'];

// Guards every service action that depends on req.user.
const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  return user;
};

const normalizeSessionId = (sessionId) => {
  const normalizedSessionId = sessionId?.trim();

  if (!normalizedSessionId) {
    throw new ApiError(400, 'Session id is required', 'VALIDATION_ERROR');
  }

  return normalizedSessionId;
};

const parsePositiveDuration = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be greater than 0`, 'VALIDATION_ERROR');
  }

  return parsed;
};

// Looks up the teacher's skill tier multiplier (S) and trust modifier (M) for Credits = T × S × M.
// Falls back to 1.0 × 1.0 if skill is not found (e.g. mentor hosting a general session).
const resolveSkillModifiers = async (teacherId, skillName) => {
  if (!skillName?.trim()) {
    return { skillTierMultiplier: 1.0, trustModifier: 1.0 };
  }

  const skill = await Skill.findOne({
    userId: teacherId,
    skillName: new RegExp(`^${skillName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    validationStatus: 'VALIDATED',
  }).lean();

  return {
    skillTierMultiplier: skill?.skillTierMultiplier ?? 1.0,
    trustModifier: skill?.trustModifier ?? 1.0,
  };
};

// Fairness safeguard: weekly credit earning cap for UNVERIFIED (probation) teachers.
// Throws if the teacher has already hit the 5 cr/week limit.
// Returns the clamped amount the teacher can still earn this week.
const enforceWeeklyCap = async (teacherId, skillName, creditsToAdd) => {
  // Check if teacher's skill is UNVERIFIED (probation applies per-skill taught).
  const skill = await Skill.findOne({
    userId: teacherId,
    skillName: new RegExp(`^${(skillName || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).lean();

  // Cap only applies when the skill taught is UNVERIFIED (trust score 0-24).
  if (!skill || skill.trustBadge !== PROBATION_BADGE) {
    return creditsToAdd;
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // back to Sunday
  weekStart.setHours(0, 0, 0, 0);

  const agg = await CreditTransaction.aggregate([
    { $match: { toUser: teacherId, createdAt: { $gte: weekStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const alreadyEarned = agg[0]?.total ?? 0;
  const remaining = PROBATION_WEEKLY_CAP_CR - alreadyEarned;

  if (remaining <= 0) {
    throw new ApiError(
      409,
      'Weekly credit cap reached — you will earn more credits once your trust score reaches Bronze',
      'WEEKLY_CAP_EXCEEDED'
    );
  }

  return Math.min(creditsToAdd, remaining);
};

// Applies the full Credits = T × S × M formula with the 4-hour session cap on T.
const resolveCompletionDurations = async (teacherId, skillName, scheduledDuration, rawActualDuration) => {
  const rawDuration = parsePositiveDuration(rawActualDuration, 'actualDuration') ?? scheduledDuration;
  // Fairness safeguard: T is capped at 4 hours per session.
  const actualDuration = Math.min(rawDuration, MAX_SESSION_HOURS);

  const { skillTierMultiplier, trustModifier } = await resolveSkillModifiers(teacherId, skillName);

  const rawCredits = actualDuration * skillTierMultiplier * trustModifier;
  const chargedCredits = Math.round(rawCredits * 100) / 100; // 2 decimal precision

  const creditFormula = `T=${actualDuration}h S=×${skillTierMultiplier} M=×${trustModifier} credits=${chargedCredits}`;

  return { actualDuration, chargedCredits, skillTierMultiplier, trustModifier, creditFormula };
};

// Keep participant payload lightweight when listing sessions.
const sanitizePublicUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    userId: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePicture: user.profilePicture,
    role: user.role,
  };
};

// "Populate" teacher/learner using userId (string refs), not ObjectId refs.
const withPopulatedParticipants = async (sessions) => {
  const userIds = [...new Set(sessions.flatMap((session) => [session.teacherId, session.learnerId]))];
  const users = await User.find({ userId: { $in: userIds } })
    .select('userId firstName lastName role')
    .lean();

  const userMap = new Map(users.map((user) => [user.userId, user]));

  return sessions.map((session) => {
    return {
      ...session,
      teacher: sanitizePublicUser(userMap.get(session.teacherId)),
      learner: sanitizePublicUser(userMap.get(session.learnerId)),
    };
  });
};

// Validates that requested teacher exists and can receive requests.
const ensureTeacherExists = async (teacherId) => {
  const teacher = await User.findOne({
    userId: teacherId,
    accountStatus: 'ACTIVE',
  });

  if (!teacher) {
    throw new ApiError(404, 'Teacher not found', 'USER_NOT_FOUND');
  }

  return teacher;
};

const assertCanHostSession = async (userId, role, categoryId) => {
  if (String(role || '').toUpperCase() === 'ADMIN') return;

  // MentorSkill (approved mentor for this category)
  const mentorSkillQuery = { userId, isActive: true };
  if (categoryId) mentorSkillQuery.skillCategoryId = categoryId;
  const mentorSkill = await MentorSkill.findOne(mentorSkillQuery).lean();
  if (mentorSkill) return;

  // Validated Skill (mentor or learner who passed skill validation)
  const skillQuery = { userId, validationStatus: 'VALIDATED' };
  if (categoryId) skillQuery.categoryId = categoryId;
  const validatedSkill = await Skill.findOne(skillQuery).lean();
  if (validatedSkill) return;

  throw new ApiError(
    403,
    'You need a validated skill in this category to create sessions',
    'FORBIDDEN'
  );
};

// Host creates a public open session that learners can browse and join.
const createPublicSession = async (currentUser, payload) => {
  const host = ensureAuthenticatedUser(currentUser);

  await assertCanHostSession(host.userId, host.role, payload.categoryId);

  const parsedCredits = Number(payload.sessionCredits);
  const sessionCredits = Number.isFinite(parsedCredits) && parsedCredits >= 0 ? parsedCredits : 0;

  const session = await Session.create({
    sessionId: `SES-${randomUUID()}`,
    teacherId: host.userId,
    learnerId: '',
    title: payload.title?.trim() || '',
    skill: payload.title?.trim() || 'General',
    categoryId: payload.categoryId || '',
    duration: 1,
    date: payload.date,
    message: payload.description?.trim() || '',
    googleMeetLink: payload.googleMeetLink?.trim() || '',
    sessionCredits,
    status: 'ACCEPTED',
  });

  const plain = session.toObject();

  // Attach populated teacher so the frontend can display the name immediately.
  const [populated] = await withPopulatedParticipants([plain]);
  return populated;
};

// Learner opens a new request-like session in PENDING state.
const requestSession = async (currentUser, payload) => {
  const learner = ensureAuthenticatedUser(currentUser);
  const teacherId = payload.teacherId.trim();

  if (learner.userId === teacherId) {
    throw new ApiError(400, 'You cannot request a session with yourself', 'VALIDATION_ERROR');
  }

  await ensureTeacherExists(teacherId);
  await ensureTeacherCanTeachSkill(teacherId, payload.skill);

  const session = await Session.create({
    sessionId: `SES-${randomUUID()}`,
    learnerId: learner.userId,
    teacherId,
    skill: payload.skill,
    categoryId: payload.categoryId || '',
    duration: payload.duration,
    date: payload.date,
    message: payload.message || '',
    status: 'PENDING',
  });

  return session.toObject();
};

// Lists sessions for current user with optional role/status filters.
const listSessionsForUser = async (currentUser, query = {}) => {
  const user = ensureAuthenticatedUser(currentUser);
  const role = query.role?.trim().toUpperCase();
  const status = query.status?.trim().toUpperCase();
  const filter = {};

  if (role) {
    if (!SESSION_ROLES.includes(role)) {
      throw new ApiError(400, 'Invalid role filter', 'VALIDATION_ERROR');
    }

    filter[role === 'TEACHER' ? 'teacherId' : 'learnerId'] = user.userId;
  } else {
    filter.$or = [{ teacherId: user.userId }, { learnerId: user.userId }];
  }

  if (status) {
    if (!SESSION_STATUSES.includes(status)) {
      throw new ApiError(400, 'Invalid status filter', 'VALIDATION_ERROR');
    }

    filter.status = status;
  }

  const sessions = await Session.find(filter).sort({ date: -1, createdAt: -1 }).limit(200).lean();
  return withPopulatedParticipants(sessions);
};

// Lists sessions across the app for discovery views.
const listSessionsDirectory = async (currentUser, query = {}) => {
  ensureAuthenticatedUser(currentUser);
  const status = query.status?.trim().toUpperCase();
  const filter = {};

  if (status && status !== 'ALL') {
    if (!SESSION_STATUSES.includes(status)) {
      throw new ApiError(400, 'Invalid status filter', 'VALIDATION_ERROR');
    }

    filter.status = status;
  }

  const sessions = await Session.find(filter).sort({ date: -1, createdAt: -1 }).limit(200).lean();
  return withPopulatedParticipants(sessions);
};

const getSessionDocumentById = async (sessionId, options = {}) => {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const session = await Session.findOne(
    {
      sessionId: normalizedSessionId,
    },
    null,
    options
  );

  if (!session) {
    throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND');
  }

  return session;
};

// Only teacher can accept and only from PENDING.
const acceptSession = async (currentUser, sessionId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const session = await getSessionDocumentById(sessionId);

  if (session.teacherId !== user.userId) {
    throw new ApiError(403, 'Only the teacher can accept this session', 'FORBIDDEN');
  }

  if (session.status !== 'PENDING') {
    throw new ApiError(409, 'Only pending sessions can be accepted', 'SESSION_INVALID_STATUS');
  }

  session.status = 'ACCEPTED';
  await session.save();

  return session.toObject();
};

// Only teacher can reject and only from PENDING.
const rejectSession = async (currentUser, sessionId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const session = await getSessionDocumentById(sessionId);

  if (session.teacherId !== user.userId) {
    throw new ApiError(403, 'Only the teacher can reject this session', 'FORBIDDEN');
  }

  if (session.status !== 'PENDING') {
    throw new ApiError(409, 'Only pending sessions can be rejected', 'SESSION_INVALID_STATUS');
  }

  session.status = 'REJECTED';
  await session.save();

  return session.toObject();
};

// Learner can cancel their own pending request.
const cancelSession = async (currentUser, sessionId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const session = await getSessionDocumentById(sessionId);

  if (session.learnerId !== user.userId) {
    throw new ApiError(403, 'Only the learner can cancel this session request', 'FORBIDDEN');
  }

  if (session.status !== 'PENDING') {
    throw new ApiError(409, 'Only pending sessions can be cancelled', 'SESSION_INVALID_STATUS');
  }

  session.status = 'REJECTED';
  await session.save();

  return session.toObject();
};

const deleteSession = async (currentUser, sessionId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const session = await getSessionDocumentById(sessionId);

  if (session.teacherId !== user.userId && session.learnerId !== user.userId) {
    throw new ApiError(403, 'Only a session participant can delete this session', 'FORBIDDEN');
  }

  if (session.status === 'COMPLETED' || session.creditsTransferred) {
    throw new ApiError(
      409,
      'Completed sessions cannot be deleted',
      'SESSION_INVALID_STATUS'
    );
  }

  const deletedSession = session.toObject();
  await session.deleteOne();

  return deletedSession;
};

// Step 1 of 2-sided confirmation: teacher marks the session as done.
// Credits do NOT transfer yet — learner must confirm first (fairness safeguard).
const completeSession = async (currentUser, sessionId, payload = {}) => {
  const user = ensureAuthenticatedUser(currentUser);
  const session = await getSessionDocumentById(sessionId);

  if (session.teacherId !== user.userId && user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only the teacher can mark this session as complete', 'FORBIDDEN');
  }

  if (session.teacherCompleted) {
    throw new ApiError(409, 'You have already marked this session as complete', 'SESSION_ALREADY_COMPLETED');
  }

  if (session.status !== 'ACCEPTED') {
    throw new ApiError(409, 'Only accepted sessions can be completed', 'SESSION_INVALID_STATUS');
  }

  const {
    actualDuration,
    chargedCredits,
    skillTierMultiplier,
    trustModifier,
    creditFormula,
  } = await resolveCompletionDurations(
    session.teacherId,
    session.skill,
    session.duration,
    payload.actualDuration
  );

  session.actualDuration = actualDuration;
  session.chargedCredits = chargedCredits;
  session.skillTierMultiplier = skillTierMultiplier;
  session.trustModifier = trustModifier;
  session.creditFormula = creditFormula;
  session.teacherCompleted = true;
  session.status = 'AWAITING_CONFIRMATION';

  await session.save();
  return session.toObject();
};

// Step 2 of 2-sided confirmation: learner confirms the session happened.
// Triggers atomic credit transfer + XP award only when BOTH sides have confirmed.
const confirmCompletion = async (currentUser, sessionId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const mongoSession = await mongoose.startSession();

  try {
    let completedSession;

    await mongoSession.withTransaction(async () => {
      const session = await getSessionDocumentById(sessionId, { session: mongoSession });

      if (session.learnerId !== user.userId) {
        throw new ApiError(403, 'Only the learner can confirm this session', 'FORBIDDEN');
      }

      if (session.status !== 'AWAITING_CONFIRMATION' || !session.teacherCompleted) {
        throw new ApiError(
          409,
          'Session is not awaiting confirmation — the teacher must mark it complete first',
          'SESSION_INVALID_STATUS'
        );
      }

      if (session.learnerConfirmed || session.creditsTransferred) {
        throw new ApiError(409, 'You have already confirmed this session', 'SESSION_ALREADY_CONFIRMED');
      }

      // Apply weekly cap for probation teachers before finalising.
      const clampedCredits = await enforceWeeklyCap(
        session.teacherId,
        session.skill,
        session.chargedCredits
      );

      await creditService.transferCredits({
        fromUserId: session.learnerId,
        toUserId: session.teacherId,
        amount: clampedCredits,
        sessionId: session.sessionId,
        mongoSession,
      });

      session.chargedCredits = clampedCredits;
      session.learnerConfirmed = true;
      session.creditsTransferred = true;
      session.status = 'COMPLETED';
      session.completedAt = new Date();

      if (!session.xpAwarded) {
        await xpService.awardSessionCompletionXP({
          teacherId: session.teacherId,
          creditsEarned: clampedCredits,
          sessionId: session.sessionId,
          skill: session.skill,
          mongoSession,
        });
        session.xpAwarded = true;
      }

      await session.save({ session: mongoSession });
      completedSession = session.toObject();
    });

    // Fire-and-forget: badges + streaks do not affect the transaction result.
    const { teacherId, learnerId } = completedSession;
    Promise.all([
      badgeService.checkTeachingBadges(teacherId),
      streakService.recordActivity(teacherId),
      streakService.recordActivity(learnerId),
    ]).catch(() => {});

    return completedSession;
  } finally {
    await mongoSession.endSession();
  }
};

// Returns all active users who have at least one validated skill, excluding the caller.
const getTeacherDirectory = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);

  const validatedSkills = await Skill.find({ validationStatus: 'VALIDATED' }).lean();

  if (!validatedSkills.length) {
    return [];
  }

  const teacherIds = [...new Set(validatedSkills.map((s) => s.userId))].filter(
    (id) => id !== user.userId
  );

  if (!teacherIds.length) {
    return [];
  }

  const teachers = await User.find({
    userId: { $in: teacherIds },
    accountStatus: 'ACTIVE',
  })
    .select('userId firstName lastName')
    .lean();

  return teachers.map((t) => ({
    id: t.userId,
    name: [t.firstName, t.lastName].filter(Boolean).join(' ') || 'Unknown user',
  }));
};

// Learner requests to join an existing public session (no skill-validation check needed).
const joinPublicSession = async (currentUser, sessionId) => {
  const learner = ensureAuthenticatedUser(currentUser);
  const publicSession = await getSessionDocumentById(sessionId);

  if (publicSession.teacherId === learner.userId) {
    throw new ApiError(400, 'You cannot join your own session', 'VALIDATION_ERROR');
  }

  if (publicSession.status !== 'ACCEPTED') {
    throw new ApiError(409, 'This session is not available to join', 'SESSION_INVALID_STATUS');
  }

  const existing = await Session.findOne({
    parentSessionId: sessionId,
    learnerId: learner.userId,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  }).lean();

  if (existing) {
    throw new ApiError(409, 'You already have an active request for this session', 'DUPLICATE_REQUEST');
  }

  const session = await Session.create({
    sessionId: `SES-${randomUUID()}`,
    learnerId: learner.userId,
    teacherId: publicSession.teacherId,
    parentSessionId: sessionId,
    skill: publicSession.skill || publicSession.title || '',
    categoryId: publicSession.categoryId || '',
    duration: publicSession.duration || 1,
    date: publicSession.date,
    message: `Join request for: ${publicSession.title || publicSession.skill || 'session'}`,
    status: 'PENDING',
  });

  return session.toObject();
};

const canHostSession = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);

  if (String(user.role || '').toUpperCase() === 'ADMIN') return { canHost: true };

  const [mentorSkill, validatedSkill] = await Promise.all([
    MentorSkill.findOne({ userId: user.userId, isActive: true }).lean(),
    Skill.findOne({ userId: user.userId, validationStatus: 'VALIDATED' }).lean(),
  ]);

  return { canHost: Boolean(mentorSkill || validatedSkill) };
};

module.exports = {
  createPublicSession,
  joinPublicSession,
  requestSession,
  listSessionsForUser,
  listSessionsDirectory,
  acceptSession,
  rejectSession,
  cancelSession,
  deleteSession,
  completeSession,
  confirmCompletion,
  getTeacherDirectory,
  canHostSession,
};
