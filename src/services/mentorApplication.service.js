const { randomUUID } = require('crypto');

const MentorApplication = require('../models/MentorApplication');
const Mentor = require('../models/Mentor');
const MentorSkill = require('../models/MentorSkill');
const Notification = require('../models/Notification');
const Skill = require('../models/Skill');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  return user;
};

const submitMentorApplication = async (currentUser, payload = {}) => {
  const user = ensureAuthenticatedUser(currentUser);

  if (user.role !== 'LEARNER') {
    throw new ApiError(403, 'Only learners can apply for mentorship', 'FORBIDDEN');
  }

  const skillFilter = { userId: user.userId, validationStatus: 'VALIDATED' };
  if (payload.skillId?.trim()) skillFilter.skillId = payload.skillId.trim();

  const validatedSkill = await Skill.findOne(skillFilter).lean();

  if (!validatedSkill) {
    throw new ApiError(
      403,
      'You need at least one validated skill to apply for mentorship',
      'FORBIDDEN'
    );
  }

  const existing = await MentorApplication.findOne({
    userId: user.userId,
    applicationStatus: { $in: ['PENDING', 'APPROVED'] },
  }).lean();

  if (existing) {
    throw new ApiError(
      409,
      'You already have an active mentorship application',
      'DUPLICATE_APPLICATION'
    );
  }

  const previousCount = await MentorApplication.countDocuments({ userId: user.userId });

  const application = await MentorApplication.create({
    applicationId: `APP-${randomUUID()}`,
    userId: user.userId,
    skillCategoryId: validatedSkill.categoryId,
    skillName: validatedSkill.skillName,
    applicationStatus: 'PENDING',
    submittedAt: new Date(),
    previousApplications: previousCount,
  });

  return application.toObject();
};

const getMyMentorApplication = async (currentUser) => {
  const user = ensureAuthenticatedUser(currentUser);

  const application = await MentorApplication.findOne({ userId: user.userId })
    .sort({ submittedAt: -1 })
    .lean();

  return application || null;
};

// ── Admin ────────────────────────────────────────────────────────────────────

const listMentorApplications = async (query = {}) => {
  const filter = {};
  const status = query.status?.trim().toUpperCase();

  if (status && status !== 'ALL') {
    filter.applicationStatus = status;
  }

  const applications = await MentorApplication.find(filter)
    .sort({ submittedAt: -1 })
    .limit(200)
    .lean();

  const userIds = [...new Set(applications.map((a) => a.userId))];
  const users = await User.find({ userId: { $in: userIds } })
    .select('userId firstName lastName email role bio portfolioUrl resumeFileName resumeStoredName')
    .lean();
  const userMap = new Map(users.map((u) => [u.userId, {
    ...u,
    resumeDownloadUrl: u.resumeStoredName ? `/uploads/resumes/${encodeURIComponent(u.resumeStoredName)}` : '',
  }]));

  return applications.map((app) => ({
    ...app,
    applicant: userMap.get(app.userId) || null,
  }));
};

const reviewMentorApplication = async (adminUser, applicationId, { decision, rejectionReason }) => {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new ApiError(400, 'Decision must be APPROVED or REJECTED', 'VALIDATION_ERROR');
  }

  const application = await MentorApplication.findOne({ applicationId });

  if (!application) {
    throw new ApiError(404, 'Application not found', 'NOT_FOUND');
  }

  if (application.applicationStatus !== 'PENDING') {
    throw new ApiError(409, 'Only pending applications can be reviewed', 'INVALID_STATUS');
  }

  application.applicationStatus = decision;
  application.reviewedAt = new Date();
  application.reviewedBy = adminUser.userId;
  if (rejectionReason) application.rejectionReason = rejectionReason;

  await application.save();

  if (decision === 'APPROVED') {
    await User.updateOne({ userId: application.userId }, { role: 'MENTOR' });

    const existingMentor = await Mentor.findOne({ userId: application.userId }).lean();
    if (!existingMentor) {
      await Mentor.create({
        userId: application.userId,
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: adminUser.userId,
      });
    }

    // Create MentorSkill record for the approved skill category (idempotent).
    const existingMentorSkill = await MentorSkill.findOne({
      userId: application.userId,
      skillCategoryId: application.skillCategoryId,
    }).lean();

    if (!existingMentorSkill) {
      await MentorSkill.create({
        mentorSkillId: `MSKL-${randomUUID()}`,
        userId: application.userId,
        skillCategoryId: application.skillCategoryId,
        skillName: application.skillName,
        verificationDate: new Date(),
        verifiedBy: adminUser.userId,
        isActive: true,
      });
    } else {
      await MentorSkill.updateOne(
        { userId: application.userId, skillCategoryId: application.skillCategoryId },
        { isActive: true, verificationDate: new Date(), verifiedBy: adminUser.userId }
      );
    }

    await Notification.create({
      notificationId: `NOTIF-${randomUUID()}`,
      userId: application.userId,
      notificationType: 'ADMIN_ACTION',
      title: 'Mentorship application approved',
      description:
        'Congratulations! Your mentorship application has been approved. You are now a mentor on Fenneky.',
      relatedEntityId: applicationId,
    });
  } else {
    await Notification.create({
      notificationId: `NOTIF-${randomUUID()}`,
      userId: application.userId,
      notificationType: 'ADMIN_ACTION',
      title: 'Mentorship application rejected',
      description: rejectionReason || 'Your mentorship application has been reviewed and rejected.',
      relatedEntityId: applicationId,
    });
  }

  return application.toObject();
};

module.exports = {
  submitMentorApplication,
  getMyMentorApplication,
  listMentorApplications,
  reviewMentorApplication,
};
