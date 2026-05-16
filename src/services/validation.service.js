const { randomUUID } = require('crypto');

const ApiError = require('../utils/ApiError');
const MentorSkill = require('../models/MentorSkill');
const Notification = require('../models/Notification');
const Skill = require('../models/Skill');
const SkillEvidence = require('../models/SkillEvidence');
const User = require('../models/User');
const ValidationRequest = require('../models/ValidationRequest');

const OPEN_REQUEST_STATUSES = ['PENDING', 'IN_REVIEW'];
const MENTOR_ROLES = new Set(['MENTOR', 'ADMIN']);

const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  return user;
};

const ensureMentorUser = (user) => {
  const mentor = ensureAuthenticatedUser(user);

  if (!MENTOR_ROLES.has(String(mentor.role || '').toUpperCase())) {
    throw new ApiError(403, 'Only mentors can manage validation requests', 'FORBIDDEN');
  }

  return mentor;
};

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const buildFullName = (user) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Unknown user';
};

const normalizeRequestId = (requestId) => {
  const normalizedRequestId = requestId?.trim();

  if (!normalizedRequestId) {
    throw new ApiError(400, 'requestId is required', 'VALIDATION_ERROR');
  }

  return normalizedRequestId;
};

const hasSkillName = (skills = [], skillName = '') => {
  const normalizedSkillName = skillName.trim().toLowerCase();

  return skills.some((skill) => String(skill).trim().toLowerCase() === normalizedSkillName);
};

const addSkillName = (skills = [], skillName = '') => {
  if (hasSkillName(skills, skillName)) {
    return skills;
  }

  return [...skills, skillName.trim()];
};

const removeSkillName = (skills = [], skillName = '') => {
  const normalizedSkillName = skillName.trim().toLowerCase();

  return skills.filter((skill) => String(skill).trim().toLowerCase() !== normalizedSkillName);
};

const findSkillForUser = async (userId, skillName) => {
  if (!skillName?.trim()) {
    return null;
  }

  return Skill.findOne({
    userId,
    skillName: new RegExp(`^${escapeRegExp(skillName.trim())}$`, 'i'),
  });
};

const canUserTeachSkill = async (userId, skillName) => {
  const normalizedSkillName = skillName?.trim();

  if (!normalizedSkillName) {
    return false;
  }

  const user = await User.findOne({ userId, accountStatus: 'ACTIVE' }).lean();

  if (!user) {
    return false;
  }

  const role = String(user.role || '').toUpperCase();

  if (role === 'MENTOR' || role === 'ADMIN') {
    if (hasSkillName(user.offeredSkills, normalizedSkillName)) {
      return true;
    }

    const mentorSkill = await MentorSkill.findOne({
      userId,
      skillName: new RegExp(`^${escapeRegExp(normalizedSkillName)}$`, 'i'),
      isActive: true,
    }).lean();

    return Boolean(mentorSkill);
  }

  const skill = await findSkillForUser(userId, normalizedSkillName);
  return skill?.validationStatus === 'VALIDATED';
};

const ensureTeacherCanTeachSkill = async (teacherId, skillName) => {
  const canTeach = await canUserTeachSkill(teacherId, skillName);

  if (!canTeach) {
    throw new ApiError(
      403,
      'This teacher is not validated to teach the requested skill',
      'SKILL_NOT_VALIDATED'
    );
  }
};

const ensureLearnerCanOfferSkill = async (userId, skillName) => {
  const canTeach = await canUserTeachSkill(userId, skillName);

  if (!canTeach) {
    throw new ApiError(
      403,
      'This skill must be validated by a mentor before you can teach it',
      'SKILL_NOT_VALIDATED'
    );
  }
};

const getValidationRequestForMentor = async (mentorUserId, requestId) => {
  const request = await ValidationRequest.findOne({
    requestId,
    mentorUserId,
  });

  if (!request) {
    throw new ApiError(404, 'Validation request not found', 'VALIDATION_REQUEST_NOT_FOUND');
  }

  return request;
};

const buildMentorRequestView = async (requests) => {
  if (!requests.length) {
    return [];
  }

  const learnerIds = [...new Set(requests.map((request) => request.learnerUserId))];
  const skillIds = [...new Set(requests.map((request) => request.skillId))];
  const [learners, skills, evidenceItems] = await Promise.all([
    User.find({ userId: { $in: learnerIds } }).lean(),
    Skill.find({ skillId: { $in: skillIds } }).lean(),
    SkillEvidence.find({ skillId: { $in: skillIds } }).lean(),
  ]);

  const learnerMap = new Map(learners.map((learner) => [learner.userId, learner]));
  const skillMap = new Map(skills.map((skill) => [skill.skillId, skill]));
  const evidenceCountMap = new Map();

  evidenceItems.forEach((evidence) => {
    evidenceCountMap.set(evidence.skillId, (evidenceCountMap.get(evidence.skillId) || 0) + 1);
  });

  return requests
    .sort((left, right) => new Date(right.submittedAt) - new Date(left.submittedAt))
    .map((request) => {
      const learner = learnerMap.get(request.learnerUserId);
      const skill = skillMap.get(request.skillId);

      return {
        requestId: request.requestId,
        status: request.requestStatus,
        submittedAt: request.submittedAt,
        respondedAt: request.respondedAt || null,
        validationScore: request.validationScore || 0,
        requestNote: request.requestNote || '',
        validationFeedback: request.validationFeedback || '',
        rejectionReason: request.rejectionReason || '',
        learner: {
          userId: request.learnerUserId,
          fullName: buildFullName(learner),
          email: learner?.email || '',
        },
        skill: {
          skillId: request.skillId,
          name: skill?.skillName || 'Unknown skill',
          proficiencyLevel: skill?.proficiencyLevel || 'BEGINNER',
          validationStatus: skill?.validationStatus || 'UNVALIDATED',
        },
        evidenceCount: evidenceCountMap.get(request.skillId) || 0,
      };
    });
};

const listMentorValidationRequests = async (currentUser, query = {}) => {
  const mentor = ensureMentorUser(currentUser);
  const status = query.status?.trim().toUpperCase();
  const filter = { mentorUserId: mentor.userId };
  const allowedStatuses = ['PENDING', 'IN_REVIEW', 'VALIDATED', 'REJECTED'];

  if (status) {
    if (!allowedStatuses.includes(status)) {
      throw new ApiError(400, 'Invalid status filter', 'VALIDATION_ERROR');
    }

    filter.requestStatus = status;
  }

  const requests = await ValidationRequest.find(filter).lean();
  const items = await buildMentorRequestView(requests);

  return {
    summary: {
      pending: items.filter((item) => OPEN_REQUEST_STATUSES.includes(item.status)).length,
      validated: items.filter((item) => item.status === 'VALIDATED').length,
      rejected: items.filter((item) => item.status === 'REJECTED').length,
    },
    requests: items,
  };
};

const acceptValidationRequest = async (currentUser, requestId, payload = {}) => {
  const mentor = ensureMentorUser(currentUser);
  const normalizedRequestId = normalizeRequestId(requestId);
  const validationScore = Number(payload.validationScore);
  const validationFeedback = payload.validationFeedback?.trim() || '';

  if (!Number.isFinite(validationScore) || validationScore < 0 || validationScore > 100) {
    throw new ApiError(400, 'validationScore must be between 0 and 100', 'VALIDATION_ERROR');
  }

  const request = await getValidationRequestForMentor(mentor.userId, normalizedRequestId);

  if (!OPEN_REQUEST_STATUSES.includes(request.requestStatus)) {
    throw new ApiError(
      409,
      'Only pending validation requests can be accepted',
      'VALIDATION_REQUEST_CLOSED'
    );
  }

  const [skill, learner] = await Promise.all([
    Skill.findOne({ skillId: request.skillId }),
    User.findOne({ userId: request.learnerUserId, accountStatus: 'ACTIVE' }),
  ]);

  if (!skill || !learner) {
    throw new ApiError(404, 'Validation request data is incomplete', 'VALIDATION_REQUEST_NOT_FOUND');
  }

  if (skill.userId !== learner.userId) {
    throw new ApiError(409, 'Skill does not belong to the requesting learner', 'VALIDATION_ERROR');
  }

  request.requestStatus = 'VALIDATED';
  request.validationScore = validationScore;
  request.validationFeedback = validationFeedback;
  request.rejectionReason = '';
  request.respondedAt = new Date();

  skill.validationStatus = 'VALIDATED';
  skill.validationScore = validationScore;
  skill.validatedBy = mentor.userId;
  skill.validatedAt = new Date();
  skill.lastUpdated = new Date();

  learner.offeredSkills = addSkillName(learner.offeredSkills, skill.skillName);

  await Promise.all([request.save(), skill.save(), learner.save()]);

  await Notification.create({
    notificationId: `NOTIF-${randomUUID()}`,
    userId: learner.userId,
    notificationType: 'SYSTEM',
    title: 'Skill validated',
    description: `${buildFullName(mentor)} validated your ${skill.skillName} skill with a score of ${validationScore}. You can now teach this skill.`,
    relatedEntityId: request.requestId,
  });

  return {
    requestId: request.requestId,
    status: request.requestStatus,
    validationScore: request.validationScore,
    skillId: skill.skillId,
    skillName: skill.skillName,
    canTeach: true,
    respondedAt: request.respondedAt,
  };
};

const rejectValidationRequest = async (currentUser, requestId, payload = {}) => {
  const mentor = ensureMentorUser(currentUser);
  const normalizedRequestId = normalizeRequestId(requestId);
  const rejectionReason = payload.rejectionReason?.trim() || 'No reason provided.';

  const request = await getValidationRequestForMentor(mentor.userId, normalizedRequestId);

  if (!OPEN_REQUEST_STATUSES.includes(request.requestStatus)) {
    throw new ApiError(
      409,
      'Only pending validation requests can be rejected',
      'VALIDATION_REQUEST_CLOSED'
    );
  }

  const [skill, learner] = await Promise.all([
    Skill.findOne({ skillId: request.skillId }),
    User.findOne({ userId: request.learnerUserId, accountStatus: 'ACTIVE' }),
  ]);

  if (!skill || !learner) {
    throw new ApiError(404, 'Validation request data is incomplete', 'VALIDATION_REQUEST_NOT_FOUND');
  }

  request.requestStatus = 'REJECTED';
  request.validationScore = 0;
  request.validationFeedback = '';
  request.rejectionReason = rejectionReason;
  request.respondedAt = new Date();

  skill.validationStatus = 'UNVALIDATED';
  skill.validationScore = 0;
  skill.validatedBy = '';
  skill.validatedAt = undefined;
  skill.lastUpdated = new Date();

  learner.offeredSkills = removeSkillName(learner.offeredSkills, skill.skillName);

  await Promise.all([request.save(), skill.save(), learner.save()]);

  await Notification.create({
    notificationId: `NOTIF-${randomUUID()}`,
    userId: learner.userId,
    notificationType: 'SYSTEM',
    title: 'Validation request rejected',
    description: `${buildFullName(mentor)} rejected your ${skill.skillName} validation request. You cannot teach this skill until it is validated.`,
    relatedEntityId: request.requestId,
  });

  return {
    requestId: request.requestId,
    status: request.requestStatus,
    rejectionReason: request.rejectionReason,
    skillId: skill.skillId,
    skillName: skill.skillName,
    canTeach: false,
    respondedAt: request.respondedAt,
  };
};

const buildInitials = (label = '') => {
  const parts = String(label)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return '??';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getMentorValidationOverview = async (mentorUserId) => {
  const requests = await ValidationRequest.find({ mentorUserId })
    .sort({ submittedAt: -1 })
    .lean();
  const pendingRequests = requests.filter((request) =>
    OPEN_REQUEST_STATUSES.includes(request.requestStatus)
  );
  const validatedRequests = requests.filter((request) => request.requestStatus === 'VALIDATED');
  const rejectedRequests = requests.filter((request) => request.requestStatus === 'REJECTED');
  const averageValidationScore = validatedRequests.length
    ? Number(
        (
          validatedRequests.reduce((sum, request) => sum + (request.validationScore || 0), 0) /
          validatedRequests.length
        ).toFixed(1)
      )
    : 0;

  const [recentPending, recentActivity] = await Promise.all([
    buildMentorRequestView(pendingRequests.slice(0, 5)),
    buildMentorRequestView(
      requests
        .filter((request) => ['VALIDATED', 'REJECTED'].includes(request.requestStatus))
        .slice(0, 5)
    ),
  ]);

  return {
    summary: {
      total: requests.length,
      pending: pendingRequests.length,
      validated: validatedRequests.length,
      rejected: rejectedRequests.length,
      averageValidationScore,
    },
    recentPending: recentPending.map((request) => ({
      id: request.requestId,
      initials: buildInitials(request.learner.fullName),
      learnerName: request.learner.fullName,
      skillName: request.skill.name,
      submittedAt: request.submittedAt,
      evidenceCount: request.evidenceCount,
      requestNote: request.requestNote,
    })),
    recentActivity: recentActivity.map((request) => ({
      id: request.requestId,
      learnerName: request.learner.fullName,
      skillName: request.skill.name,
      status: request.status,
      validationScore: request.validationScore,
      rejectionReason: request.rejectionReason,
      respondedAt: request.respondedAt,
    })),
  };
};

module.exports = {
  canUserTeachSkill,
  ensureTeacherCanTeachSkill,
  ensureLearnerCanOfferSkill,
  listMentorValidationRequests,
  acceptValidationRequest,
  rejectValidationRequest,
  getMentorValidationOverview,
};
