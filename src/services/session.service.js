const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const Session = require('../models/Session');
const Skill = require('../models/Skill');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const creditService = require('./credit.service');
const xpService = require('./xp.service');
const { ensureTeacherCanTeachSkill } = require('./validation.service');

const SESSION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'];
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

const resolveCompletionDurations = (scheduledDuration, rawActualDuration) => {
  const actualDuration = parsePositiveDuration(rawActualDuration, 'actualDuration') ?? scheduledDuration;

  return {
    actualDuration,
    chargedCredits: Math.min(scheduledDuration, actualDuration),
  };
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

const HOSTING_ROLES = new Set(['MENTOR', 'ADMIN', 'admin']);

const assertCanHostSession = async (userId, role) => {
  if (HOSTING_ROLES.has(role)) return;

  const validatedSkill = await Skill.findOne({
    userId,
    validationStatus: 'VALIDATED',
  }).lean();

  if (!validatedSkill) {
    throw new ApiError(
      403,
      'Only mentors or learners with a validated skill can create sessions',
      'FORBIDDEN'
    );
  }
};

// Host creates a public open session that learners can browse and join.
const createPublicSession = async (currentUser, payload) => {
  const host = ensureAuthenticatedUser(currentUser);

  await assertCanHostSession(host.userId, host.role);

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

// Completes session + transfers credits atomically in one DB transaction.
const completeSession = async (currentUser, sessionId, payload = {}) => {
  const user = ensureAuthenticatedUser(currentUser);
  const mongoSession = await mongoose.startSession();

  try {
    let completedSession;

    await mongoSession.withTransaction(async () => {
      const session = await getSessionDocumentById(sessionId, { session: mongoSession });

      if (session.teacherId !== user.userId && user.role !== 'ADMIN') {
        throw new ApiError(403, 'Only the teacher can complete this session', 'FORBIDDEN');
      }

      if (session.status === 'COMPLETED' || session.creditsTransferred || session.xpAwarded) {
        throw new ApiError(409, 'Session has already been completed', 'SESSION_ALREADY_COMPLETED');
      }

      if (session.status !== 'ACCEPTED') {
        throw new ApiError(409, 'Only accepted sessions can be completed', 'SESSION_INVALID_STATUS');
      }

      const { actualDuration, chargedCredits } = resolveCompletionDurations(
        session.duration,
        payload.actualDuration
      );

      // Transfer amount is capped by the booked duration (1 hour = 1 credit).
      await creditService.transferCredits({
        fromUserId: session.learnerId,
        toUserId: session.teacherId,
        amount: chargedCredits,
        sessionId: session.sessionId,
        mongoSession,
      });

      session.actualDuration = actualDuration;
      session.chargedCredits = chargedCredits;
      session.status = 'COMPLETED';
      session.creditsTransferred = true;
      session.completedAt = new Date();

      // Teacher earns XP from credits taught: 1 credit = 10 XP (MVP rule, once per session).
      if (!session.xpAwarded) {
        await xpService.awardSessionCompletionXP({
          teacherId: session.teacherId,
          creditsEarned: chargedCredits,
          sessionId: session.sessionId,
          skill: session.skill,
          mongoSession,
        });
        session.xpAwarded = true;
      }

      await session.save({ session: mongoSession });

      completedSession = session.toObject();
    });

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

  if (HOSTING_ROLES.has(user.role)) {
    return { canHost: true };
  }

  const validatedSkill = await Skill.findOne({
    userId: user.userId,
    validationStatus: 'VALIDATED',
  }).lean();

  return { canHost: Boolean(validatedSkill) };
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
  getTeacherDirectory,
  canHostSession,
};
