const { randomUUID } = require('crypto');

const ApiError = require('../utils/ApiError');
const Mentor = require('../models/Mentor');
const MentoringRequest = require('../models/MentoringRequest');
const Notification = require('../models/Notification');
const Skill = require('../models/Skill');
const User = require('../models/User');

const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }
  return user;
};

const buildFullName = (user) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Unknown user';
};

const normalizeRequestId = (requestId) => {
  const normalized = requestId?.trim();
  if (!normalized) {
    throw new ApiError(400, 'requestId is required', 'VALIDATION_ERROR');
  }
  return normalized;
};

const buildRequestView = async (requests) => {
  if (!requests.length) return [];

  const learnerIds = [...new Set(requests.map((r) => r.learnerUserId))];
  const skillIds = [...new Set(requests.map((r) => r.skillId))];

  const [learners, skills] = await Promise.all([
    User.find({ userId: { $in: learnerIds } }).lean(),
    Skill.find({ skillId: { $in: skillIds } }).lean(),
  ]);

  const learnerMap = new Map(learners.map((u) => [u.userId, u]));
  const skillMap = new Map(skills.map((s) => [s.skillId, s]));

  return requests
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .map((request) => {
      const learner = learnerMap.get(request.learnerUserId);
      const skill = skillMap.get(request.skillId);

      return {
        requestId: request.requestId,
        status: request.requestStatus,
        submittedAt: request.submittedAt,
        respondedAt: request.respondedAt || null,
        portfolioLink: request.portfolioLink || '',
        proofFileName: request.proofFileName || '',
        proofStoredName: request.proofStoredName || '',
        requestNote: request.requestNote || '',
        approvalScore: request.approvalScore || 0,
        approvalFeedback: request.approvalFeedback || '',
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
          validationStatus: skill?.validationStatus || 'VALIDATED',
        },
      };
    });
};

// POST /mentoring-requests — learner submits
const submitMentoringRequest = async (currentUser, payload = {}) => {
  const user = ensureAuthenticatedUser(currentUser);

  if (String(user.role || '').toUpperCase() !== 'LEARNER') {
    throw new ApiError(403, 'Only learners can submit mentoring requests', 'FORBIDDEN');
  }

  const normalizedSkillId = payload.skillId?.trim();

  if (!normalizedSkillId) {
    throw new ApiError(400, 'skillId is required', 'VALIDATION_ERROR');
  }

  const skill = await Skill.findOne({
    skillId: normalizedSkillId,
    userId: user.userId,
    validationStatus: 'VALIDATED',
  }).lean();

  if (!skill) {
    throw new ApiError(
      403,
      'The selected skill must be validated before you can request mentoring status',
      'SKILL_NOT_VALIDATED'
    );
  }

  const existingOpen = await MentoringRequest.findOne({
    skillId: normalizedSkillId,
    learnerUserId: user.userId,
    requestStatus: 'PENDING',
  }).lean();

  if (existingOpen) {
    throw new ApiError(
      409,
      'A mentoring request for this skill is already pending',
      'MENTORING_REQUEST_EXISTS'
    );
  }

  const existingApproved = await MentoringRequest.findOne({
    skillId: normalizedSkillId,
    learnerUserId: user.userId,
    requestStatus: 'APPROVED',
  }).lean();

  if (existingApproved) {
    throw new ApiError(
      409,
      'Your mentoring request for this skill has already been approved',
      'MENTORING_REQUEST_ALREADY_APPROVED'
    );
  }

  const request = await MentoringRequest.create({
    requestId: `MNT-${randomUUID()}`,
    skillId: normalizedSkillId,
    learnerUserId: user.userId,
    requestStatus: 'PENDING',
    portfolioLink: payload.portfolioLink?.trim() || '',
    requestNote: payload.requestNote?.trim() || '',
    proofFileName: payload.proofFileName || '',
    proofStoredName: payload.proofStoredName || '',
    proofMimeType: payload.proofMimeType || '',
  });

  return {
    requestId: request.requestId,
    skillId: request.skillId,
    status: request.requestStatus,
    submittedAt: request.submittedAt,
  };
};

// GET /mentoring-requests/my — learner views own requests
const getMyMentoringRequests = async (currentUser, query = {}) => {
  const user = ensureAuthenticatedUser(currentUser);
  const status = query.status?.trim().toUpperCase();
  const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED'];

  if (status && !allowedStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status filter', 'VALIDATION_ERROR');
  }

  const filter = { learnerUserId: user.userId };
  if (status) filter.requestStatus = status;

  const requests = await MentoringRequest.find(filter).lean();
  const items = await buildRequestView(requests);

  return { requests: items };
};

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /admin/mentoring-requests
const listMentoringRequests = async (query = {}) => {
  const filter = {};
  const status = query.status?.trim().toUpperCase();

  if (status && status !== 'ALL') {
    filter.requestStatus = status;
  }

  const [allRequests, filteredRequests] = await Promise.all([
    MentoringRequest.find({}).lean(),
    MentoringRequest.find(filter).lean(),
  ]);

  const items = await buildRequestView(filteredRequests);

  return {
    summary: {
      pending: allRequests.filter((r) => r.requestStatus === 'PENDING').length,
      approved: allRequests.filter((r) => r.requestStatus === 'APPROVED').length,
      rejected: allRequests.filter((r) => r.requestStatus === 'REJECTED').length,
    },
    requests: items,
  };
};

// PATCH /admin/mentoring-requests/:id/approve
const approveMentoringRequest = async (adminUser, requestId, payload = {}) => {
  const admin = ensureAuthenticatedUser(adminUser);
  const normalizedRequestId = normalizeRequestId(requestId);
  const approvalScore = Number(payload.approvalScore);
  const approvalFeedback = payload.approvalFeedback?.trim() || '';

  if (!Number.isFinite(approvalScore) || approvalScore < 0 || approvalScore > 100) {
    throw new ApiError(400, 'approvalScore must be between 0 and 100', 'VALIDATION_ERROR');
  }

  const request = await MentoringRequest.findOne({ requestId: normalizedRequestId });

  if (!request) {
    throw new ApiError(404, 'Mentoring request not found', 'MENTORING_REQUEST_NOT_FOUND');
  }

  if (request.requestStatus !== 'PENDING') {
    throw new ApiError(
      409,
      'Only pending mentoring requests can be approved',
      'MENTORING_REQUEST_CLOSED'
    );
  }

  const learner = await User.findOne({ userId: request.learnerUserId, accountStatus: 'ACTIVE' });

  if (!learner) {
    throw new ApiError(404, 'Learner not found', 'USER_NOT_FOUND');
  }

  request.requestStatus = 'APPROVED';
  request.approvalScore = approvalScore;
  request.approvalFeedback = approvalFeedback;
  request.rejectionReason = '';
  request.reviewedBy = admin.userId;
  request.respondedAt = new Date();

  learner.role = 'MENTOR';

  await Promise.all([request.save(), learner.save()]);

  const existingMentor = await Mentor.findOne({ userId: learner.userId }).lean();
  if (!existingMentor) {
    await Mentor.create({
      userId: learner.userId,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedBy: admin.userId,
    });
  }

  const skill = await Skill.findOne({ skillId: request.skillId }).lean();

  await Notification.create({
    notificationId: `NOTIF-${randomUUID()}`,
    userId: learner.userId,
    notificationType: 'ADMIN_ACTION',
    title: 'Mentoring request approved',
    description: `Congratulations! Your mentoring request for ${skill?.skillName || 'the skill'} has been approved. You are now a mentor on Fenneky.`,
    relatedEntityId: request.requestId,
  });

  return {
    requestId: request.requestId,
    status: request.requestStatus,
    approvalScore: request.approvalScore,
    approvalFeedback: request.approvalFeedback,
    respondedAt: request.respondedAt,
  };
};

// PATCH /admin/mentoring-requests/:id/reject
const rejectMentoringRequest = async (adminUser, requestId, payload = {}) => {
  const admin = ensureAuthenticatedUser(adminUser);
  const normalizedRequestId = normalizeRequestId(requestId);
  const rejectionReason = payload.rejectionReason?.trim() || 'No reason provided.';

  const request = await MentoringRequest.findOne({ requestId: normalizedRequestId });

  if (!request) {
    throw new ApiError(404, 'Mentoring request not found', 'MENTORING_REQUEST_NOT_FOUND');
  }

  if (request.requestStatus !== 'PENDING') {
    throw new ApiError(
      409,
      'Only pending mentoring requests can be rejected',
      'MENTORING_REQUEST_CLOSED'
    );
  }

  request.requestStatus = 'REJECTED';
  request.rejectionReason = rejectionReason;
  request.approvalFeedback = '';
  request.reviewedBy = admin.userId;
  request.respondedAt = new Date();

  await request.save();

  const skill = await Skill.findOne({ skillId: request.skillId }).lean();

  await Notification.create({
    notificationId: `NOTIF-${randomUUID()}`,
    userId: request.learnerUserId,
    notificationType: 'ADMIN_ACTION',
    title: 'Mentoring request rejected',
    description:
      rejectionReason ||
      `Your mentoring request for ${skill?.skillName || 'the skill'} has been reviewed and rejected.`,
    relatedEntityId: request.requestId,
  });

  return {
    requestId: request.requestId,
    status: request.requestStatus,
    rejectionReason: request.rejectionReason,
    respondedAt: request.respondedAt,
  };
};

module.exports = {
  submitMentoringRequest,
  getMyMentoringRequests,
  listMentoringRequests,
  approveMentoringRequest,
  rejectMentoringRequest,
};
