const { randomUUID } = require('crypto');

const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const CreditBalance = require('../models/CreditBalance');
const CreditTransaction = require('../models/CreditTransaction');
const MentorApplication = require('../models/MentorApplication');
const Report = require('../models/Report');
const Session = require('../models/Session');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitizeUser } = require('./user.service');
const {
  ADMIN_ASSIGNABLE_ROLES,
  ADMIN_PERMISSION_KEYS,
  REPORT_STATUSES,
  USER_ACCOUNT_STATUSES,
} = require('../constants/admin');
const {
  buildAdminAccessContext,
  ensureAdminProfileForUser,
  isAdminRole,
  normalizePermissionList,
} = require('./admin-access.service');
const { createAuditLog, listAuditLogs } = require('./admin-audit.service');

const ADMIN_ASSIGNABLE_ROLE_SET = new Set(ADMIN_ASSIGNABLE_ROLES);
const USER_ACCOUNT_STATUS_SET = new Set(USER_ACCOUNT_STATUSES);
const REPORT_STATUS_SET = new Set(REPORT_STATUSES);
const ADMIN_ROLE_QUERY_VALUES = ['admin', 'ADMIN'];
const MANAGE_ADMINS_PERMISSION = 'manage_admins';

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeUserId = (id) => {
  const userId = id?.trim();

  if (!userId) {
    throw new ApiError(400, 'User id is required', 'VALIDATION_ERROR');
  }

  return userId;
};

const normalizeSettingKey = (key) => {
  const settingKey = key?.trim();

  if (!settingKey) {
    throw new ApiError(400, 'Setting key is required', 'VALIDATION_ERROR');
  }

  return settingKey;
};

const normalizeReportId = (id) => {
  const reportId = id?.trim();

  if (!reportId) {
    throw new ApiError(400, 'Report id is required', 'VALIDATION_ERROR');
  }

  return reportId;
};

const parsePositiveInteger = (value, fallback, fieldName, max = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiError(400, `${fieldName} must be a positive integer`, 'VALIDATION_ERROR');
  }

  return Math.min(parsed, max);
};

const splitDisplayName = (name) => {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  const [firstName, ...rest] = normalizedName.split(' ');

  return {
    firstName,
    lastName: rest.join(' '),
  };
};

const normalizeRole = (role) => {
  const normalizedRole = String(role || '').trim();

  if (!normalizedRole || !ADMIN_ASSIGNABLE_ROLE_SET.has(normalizedRole)) {
    throw new ApiError(400, 'Invalid role value', 'VALIDATION_ERROR');
  }

  return normalizedRole;
};

const normalizeAccountStatus = (status) => {
  const normalizedStatus = String(status || '').trim().toUpperCase();

  if (!normalizedStatus || !USER_ACCOUNT_STATUS_SET.has(normalizedStatus)) {
    throw new ApiError(400, 'Invalid account status value', 'VALIDATION_ERROR');
  }

  return normalizedStatus;
};

const normalizeReportStatus = (status) => {
  const normalizedStatus = String(status || '').trim().toUpperCase();

  if (!normalizedStatus || !REPORT_STATUS_SET.has(normalizedStatus)) {
    throw new ApiError(400, 'Invalid report status value', 'VALIDATION_ERROR');
  }

  return normalizedStatus;
};

const toPlainObject = (document) => {
  return document?.toObject ? document.toObject() : { ...document };
};

const serializeAdminProfile = (adminProfile) => {
  if (!adminProfile) {
    return null;
  }

  const plainAdmin = toPlainObject(adminProfile);

  return {

    userId: plainAdmin.userId,
    permissions: normalizePermissionList(plainAdmin.permissions, {
      fallbackToDefault: true,
    }),
    assignedDate: plainAdmin.assignedDate || null,
    lastActiveDate: plainAdmin.lastActiveDate || null,
    assignedSkillCategoryId: plainAdmin.assignedSkillCategoryId || '',
    skillName: plainAdmin.skillName || '',
  };
};

const attachAdminMetadata = async (sanitizedUser) => {
  if (!isAdminRole(sanitizedUser.role)) {
    return sanitizedUser;
  }

  const adminProfile = await Admin.findOne({ userId: sanitizedUser.userId });

  return {
    ...sanitizedUser,
    adminProfile: serializeAdminProfile(adminProfile),
  };
};

const buildUserSearchFilter = (query = {}) => {
  const filter = {};

  if (query.role?.trim()) {
    const normalizedRole = normalizeRole(query.role.trim());
    filter.role =
      normalizedRole.toLowerCase() === 'admin'
        ? { $in: ADMIN_ROLE_QUERY_VALUES }
        : normalizedRole;
  }

  if (query.accountStatus?.trim()) {
    filter.accountStatus = normalizeAccountStatus(query.accountStatus);
  }

  if (query.q?.trim()) {
    const searchRegex = new RegExp(escapeRegExp(query.q.trim().replace(/\s+/g, ' ')), 'i');
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { userId: searchRegex },
    ];
  }

  return filter;
};

const getUserDocumentById = async (id) => {
  const userId = normalizeUserId(id);
  const user = await User.findOne({ userId });

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
};

const countActiveAdmins = async () => {
  return User.countDocuments({
    role: { $in: ADMIN_ROLE_QUERY_VALUES },
    accountStatus: 'ACTIVE',
  });
};

const getActiveAdminUserIdsWithPermission = async (permission) => {
  const adminProfiles = await Admin.find({
    permissions: normalizePermissionList([permission])[0],
  });
  const userIds = adminProfiles
    .map((adminProfile) => adminProfile.userId)
    .filter(Boolean);

  if (!userIds.length) {
    return [];
  }

  const adminUsers = await User.find({
    userId: { $in: userIds },
    role: { $in: ADMIN_ROLE_QUERY_VALUES },
    accountStatus: 'ACTIVE',
  });

  return adminUsers.map((user) => user.userId);
};

const assertSelfAdminMutationsAreSafe = ({ targetUser, currentUserId, nextRole, nextStatus }) => {
  if (targetUser.userId !== currentUserId || !isAdminRole(targetUser.role)) {
    return;
  }

  if (!isAdminRole(nextRole)) {
    throw new ApiError(
      400,
      'Admin cannot remove their own admin role',
      'SELF_ROLE_CHANGE_FORBIDDEN'
    );
  }

  if (nextStatus !== 'ACTIVE') {
    throw new ApiError(
      400,
      'Admin cannot change their own account status to an inactive state',
      'SELF_STATUS_CHANGE_FORBIDDEN'
    );
  }
};

const assertLastActiveAdminRemains = async ({ targetUser, nextRole, nextStatus }) => {
  const targetIsActiveAdmin = isAdminRole(targetUser.role) && targetUser.accountStatus === 'ACTIVE';
  const remainsActiveAdmin = isAdminRole(nextRole) && nextStatus === 'ACTIVE';

  if (!targetIsActiveAdmin || remainsActiveAdmin) {
    return;
  }

  const activeAdmins = await countActiveAdmins();

  if (activeAdmins <= 1) {
    throw new ApiError(
      400,
      'At least one active admin must remain on the platform',
      'LAST_ADMIN_PROTECTED'
    );
  }
};

const assertManageAdminsPermissionHolderRemains = async ({
  targetUser,
  nextPermissions,
  currentUserId,
}) => {
  if (!isAdminRole(targetUser.role) || targetUser.accountStatus !== 'ACTIVE') {
    return;
  }

  const currentAdminProfile = await Admin.findOne({ userId: targetUser.userId });
  const currentPermissions = normalizePermissionList(currentAdminProfile?.permissions, {
    fallbackToDefault: true,
  });
  const willKeepPermission = nextPermissions.includes(MANAGE_ADMINS_PERMISSION);

  if (!currentPermissions.includes(MANAGE_ADMINS_PERMISSION) || willKeepPermission) {
    return;
  }

  if (targetUser.userId === currentUserId) {
    throw new ApiError(
      400,
      'Admin cannot remove their own manage_admins permission',
      'SELF_PERMISSION_CHANGE_FORBIDDEN'
    );
  }

  const activeAdminUserIds = await getActiveAdminUserIdsWithPermission(MANAGE_ADMINS_PERMISSION);

  if (activeAdminUserIds.length <= 1 && activeAdminUserIds.includes(targetUser.userId)) {
    throw new ApiError(
      400,
      'At least one active admin must keep the manage_admins permission',
      'LAST_PERMISSION_HOLDER_PROTECTED'
    );
  }
};

const listUsers = async (query = {}) => {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = parsePositiveInteger(query.limit, 20, 'limit', 100);
  const skip = (page - 1) * limit;
  const filter = buildUserSearchFilter(query);

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((user) => sanitizeUser(user)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

const getSingleUser = async (id) => {
  const user = await getUserDocumentById(id);
  return attachAdminMetadata(sanitizeUser(user));
};

const updateUser = async (id, payload = {}, currentUser, options = {}) => {
  const user = await getUserDocumentById(id);
  const currentUserId = normalizeUserId(currentUser?.userId);
  const adminAccess = await buildAdminAccessContext(currentUser);
  const nextRole = payload.role !== undefined ? normalizeRole(payload.role) : user.role;
  const nextStatus = user.accountStatus;

  assertSelfAdminMutationsAreSafe({
    targetUser: user,
    currentUserId,
    nextRole,
    nextStatus,
  });
  await assertLastActiveAdminRemains({
    targetUser: user,
    nextRole,
    nextStatus,
  });

  const before = sanitizeUser(user);

  if (
    payload.role !== undefined &&
    !adminAccess.permissions.includes(MANAGE_ADMINS_PERMISSION)
  ) {
    throw new ApiError(
      403,
      'Forbidden: missing admin permissions (manage_admins)',
      'FORBIDDEN'
    );
  }

  if (payload.name !== undefined) {
    const { firstName, lastName } = splitDisplayName(payload.name);
    user.firstName = firstName;
    user.lastName = lastName;
  }

  if (payload.email !== undefined) {
    user.email = payload.email.trim().toLowerCase();
  }

  if (payload.role !== undefined) {
    user.role = nextRole;
  }

  await user.save();

  if (isAdminRole(user.role)) {
    await ensureAdminProfileForUser(user);
  }

  const sanitizedUser = sanitizeUser(user);

  await createAuditLog({
    adminProfile: adminAccess.adminProfile,
    userId: user.userId,
    actionType: 'ADMIN_USER_UPDATED',
    targetEntityId: user.userId,
    targetEntityType: 'User',
    details: {
      before,
      after: sanitizedUser,
    },
    ipAddress: options.ipAddress || '',
  });

  return attachAdminMetadata(sanitizedUser);
};

const deleteUser = async (targetUserId, currentUser, options = {}) => {
  const normalizedTargetUserId = normalizeUserId(targetUserId);
  const normalizedCurrentUserId = normalizeUserId(currentUser?.userId);

  if (normalizedTargetUserId === normalizedCurrentUserId) {
    throw new ApiError(400, 'Admin cannot delete self', 'SELF_DELETE_FORBIDDEN');
  }

  const user = await getUserDocumentById(normalizedTargetUserId);
  const adminAccess = await buildAdminAccessContext(currentUser);

  await assertLastActiveAdminRemains({
    targetUser: user,
    nextRole: 'user',
    nextStatus: 'BANNED',
  });

  const deletedUser = sanitizeUser(user);
  await user.deleteOne();

  await createAuditLog({
    adminProfile: adminAccess.adminProfile,
    userId: user.userId,
    actionType: 'ADMIN_USER_DELETED',
    targetEntityId: user.userId,
    targetEntityType: 'User',
    details: deletedUser,
    ipAddress: options.ipAddress || '',
  });

  return deletedUser;
};

const updateUserRole = async (id, role, currentUser, options = {}) => {
  const user = await getUserDocumentById(id);
  const nextRole = normalizeRole(role);
  const currentUserId = normalizeUserId(currentUser?.userId);
  const adminAccess = await buildAdminAccessContext(currentUser);

  assertSelfAdminMutationsAreSafe({
    targetUser: user,
    currentUserId,
    nextRole,
    nextStatus: user.accountStatus,
  });
  await assertLastActiveAdminRemains({
    targetUser: user,
    nextRole,
    nextStatus: user.accountStatus,
  });

  const previousRole = user.role;
  user.role = nextRole;
  await user.save();

  let adminProfile = null;

  if (isAdminRole(nextRole)) {
    adminProfile = await ensureAdminProfileForUser(user);
  }

  await createAuditLog({
    adminProfile: adminAccess.adminProfile,
    userId: user.userId,
    actionType: 'ADMIN_ROLE_UPDATED',
    targetEntityId: user.userId,
    targetEntityType: 'User',
    details: {
      previousRole,
      nextRole,
      permissions: adminProfile?.permissions || [],
    },
    ipAddress: options.ipAddress || '',
  });

  return attachAdminMetadata(sanitizeUser(user));
};

const updateUserPermissions = async (id, permissions, currentUser, options = {}) => {
  const user = await getUserDocumentById(id);
  const currentUserId = normalizeUserId(currentUser?.userId);

  if (!isAdminRole(user.role)) {
    throw new ApiError(400, 'Permissions can only be assigned to admin users', 'NOT_AN_ADMIN');
  }

  const nextPermissions = normalizePermissionList(permissions);
  await assertManageAdminsPermissionHolderRemains({
    targetUser: user,
    nextPermissions,
    currentUserId,
  });

  const adminAccess = await buildAdminAccessContext(currentUser);
  const adminProfile = await ensureAdminProfileForUser(user, {
    permissions: nextPermissions,
  });

  await createAuditLog({
    adminProfile: adminAccess.adminProfile,
    userId: user.userId,
    actionType: 'ADMIN_PERMISSIONS_UPDATED',
    targetEntityId: user.userId,
    targetEntityType: 'Admin',
    details: {
      permissions: adminProfile.permissions,
    },
    ipAddress: options.ipAddress || '',
  });

  return {
    userId: user.userId,
    role: user.role,
    permissions: adminProfile.permissions,
  };
};

const updateUserStatus = async (id, payload = {}, currentUser, options = {}) => {
  const user = await getUserDocumentById(id);
  const currentUserId = normalizeUserId(currentUser?.userId);
  const nextStatus = normalizeAccountStatus(payload.accountStatus);
  const adminAccess = await buildAdminAccessContext(currentUser);

  assertSelfAdminMutationsAreSafe({
    targetUser: user,
    currentUserId,
    nextRole: user.role,
    nextStatus,
  });
  await assertLastActiveAdminRemains({
    targetUser: user,
    nextRole: user.role,
    nextStatus,
  });

  const previousStatus = user.accountStatus;
  user.accountStatus = nextStatus;
  await user.save();

  if (isAdminRole(user.role) && nextStatus === 'ACTIVE') {
    await ensureAdminProfileForUser(user);
  }

  await createAuditLog({
    adminProfile: adminAccess.adminProfile,
    userId: user.userId,
    actionType: 'ADMIN_STATUS_UPDATED',
    targetEntityId: user.userId,
    targetEntityType: 'User',
    details: {
      previousStatus,
      nextStatus,
    },
    reason: payload.reason || '',
    ipAddress: options.ipAddress || '',
  });

  return attachAdminMetadata(sanitizeUser(user));
};

const getDashboard = async () => {
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    bannedUsers,
    totalAdmins,
    totalLearners,
    totalMentors,
    pendingReports,
    reportsUnderReview,
    reportedUserIds,
    pendingMentorApplications,
    totalSettings,
    totalAuditEntries,
    recentAuditLogs,
    creditAggregation,
    totalCreditTransactions,
    totalSessions,
    pendingSessions,
    acceptedSessions,
    completedSessions,
    rejectedSessions,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ accountStatus: 'ACTIVE' }),
    User.countDocuments({ accountStatus: 'SUSPENDED' }),
    User.countDocuments({ accountStatus: 'BANNED' }),
    User.countDocuments({ role: { $in: ADMIN_ROLE_QUERY_VALUES } }),
    User.countDocuments({ role: 'LEARNER' }),
    User.countDocuments({ role: 'MENTOR' }),
    Report.countDocuments({ reportStatus: 'PENDING' }),
    Report.countDocuments({ reportStatus: 'UNDER_REVIEW' }),
    Report.distinct('reportedUserId', { reportStatus: { $in: ['PENDING', 'UNDER_REVIEW'] } }),
    MentorApplication.countDocuments({ applicationStatus: 'PENDING' }),
    SystemSettings.countDocuments({}),
    AuditLog.countDocuments({}),
    AuditLog.find({}).sort({ timestamp: -1 }).limit(10).lean(),
    CreditBalance.aggregate([
      {
        $group: {
          _id: null,
          totalInCirculation: { $sum: '$currentBalance' },
          totalEarned: { $sum: '$totalEarned' },
          totalSpent: { $sum: '$totalSpent' },
        },
      },
    ]),
    CreditTransaction.countDocuments({}),
    Session.countDocuments({}),
    Session.countDocuments({ status: 'PENDING' }),
    Session.countDocuments({ status: 'ACCEPTED' }),
    Session.countDocuments({ status: 'COMPLETED' }),
    Session.countDocuments({ status: 'REJECTED' }),
  ]);

  const creditStats = creditAggregation[0] || {
    totalInCirculation: 0,
    totalEarned: 0,
    totalSpent: 0,
  };

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      banned: bannedUsers,
      admins: totalAdmins,
      learners: totalLearners,
      mentors: totalMentors,
    },
    moderation: {
      pendingReports,
      reportsUnderReview,
      reportedUsers: reportedUserIds.length,
      pendingMentorApplications,
    },
    credits: {
      totalInCirculation: creditStats.totalInCirculation,
      totalEarned: creditStats.totalEarned,
      totalSpent: creditStats.totalSpent,
      totalTransactions: totalCreditTransactions,
    },
    sessions: {
      total: totalSessions,
      pending: pendingSessions,
      accepted: acceptedSessions,
      completed: completedSessions,
      rejected: rejectedSessions,
    },
    system: {
      settingsCount: totalSettings,
      auditEntries: totalAuditEntries,
      recentActivity: recentAuditLogs,
      supportedAdminPermissions: [...ADMIN_PERMISSION_KEYS],
    },
  };
};

const getAuditLogs = async (query = {}) => {
  return listAuditLogs(query);
};

const listReports = async (query = {}) => {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = parsePositiveInteger(query.limit, 20, 'limit', 100);
  const skip = (page - 1) * limit;
  const filter = {};

  if (query.reportStatus?.trim()) {
    filter.reportStatus = normalizeReportStatus(query.reportStatus);
  }

  if (query.assignedTo?.trim()) {
    filter.assignedTo = query.assignedTo.trim();
  }

  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(filter),
  ]);

  return {
    items: items.map(toPlainObject),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

const updateReport = async (id, payload = {}, currentUser, options = {}) => {
  const reportId = normalizeReportId(id);
  const report = await Report.findOne({ reportId });

  if (!report) {
    throw new ApiError(404, 'Report not found', 'REPORT_NOT_FOUND');
  }

  const adminAccess = await buildAdminAccessContext(currentUser);
  const nextStatus = normalizeReportStatus(payload.reportStatus);
  report.reportStatus = nextStatus;
  report.assignedTo = adminAccess.adminProfile.userId;

  if (payload.resolution !== undefined) {
    report.resolution = payload.resolution.trim();
  }

  if (nextStatus === 'RESOLVED' || nextStatus === 'DISMISSED') {
    report.resolutionDate = new Date();
  } else {
    report.resolutionDate = undefined;
  }

  await report.save();

  await createAuditLog({
    adminProfile: adminAccess.adminProfile,
    userId: report.reportedUserId,
    actionType: 'REPORT_STATUS_UPDATED',
    targetEntityId: report.reportId,
    targetEntityType: 'Report',
    details: {
      reportStatus: report.reportStatus,
      assignedTo: report.assignedTo,
      resolution: report.resolution || '',
    },
    ipAddress: options.ipAddress || '',
  });

  return toPlainObject(report);
};

const listSettings = async () => {
  const settings = await SystemSettings.find({}).sort({ settingKey: 1 });
  return settings.map(toPlainObject);
};

const updateSetting = async (key, payload = {}, currentUser, options = {}) => {
  const settingKey = normalizeSettingKey(key);
  const adminAccess = await buildAdminAccessContext(currentUser);
  let setting = await SystemSettings.findOne({ settingKey });

  if (!setting) {
    setting = new SystemSettings({
      settingId: `SETTING-${randomUUID()}`,
      settingKey,
    });
  }

  setting.settingValue = String(payload.value);
  setting.description = payload.description !== undefined ? payload.description.trim() : '';
  setting.updatedBy = adminAccess.adminProfile.userId;
  setting.updatedAt = new Date();

  await setting.save();

  await createAuditLog({
    adminProfile: adminAccess.adminProfile,
    actionType: 'SYSTEM_SETTING_UPDATED',
    targetEntityId: setting.settingKey,
    targetEntityType: 'SystemSetting',
    details: {
      settingValue: setting.settingValue,
      description: setting.description,
    },
    ipAddress: options.ipAddress || '',
  });

  return toPlainObject(setting);
};

module.exports = {
  listUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  updateUserRole,
  updateUserPermissions,
  updateUserStatus,
  getDashboard,
  getAuditLogs,
  listReports,
  updateReport,
  listSettings,
  updateSetting,
};
