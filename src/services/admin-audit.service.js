const { randomUUID } = require('crypto');

const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

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

const toPlainObject = (document) => {
  return document?.toObject ? document.toObject() : { ...document };
};

const createAuditLog = async ({
  adminProfile,
  userId = '',
  actionType,
  targetEntityId = '',
  targetEntityType = '',
  details = {},
  reason = '',
  ipAddress = '',
}) => {
  if (!adminProfile?.userId) {
    throw new ApiError(403, 'Admin profile is required for audit logging', 'FORBIDDEN');
  }

  if (!actionType || !String(actionType).trim()) {
    throw new ApiError(400, 'Audit action type is required', 'VALIDATION_ERROR');
  }

  const auditLog = await AuditLog.create({
    auditId: `AUD-${randomUUID()}`,
    adminUserId: adminProfile.userId,
    userId: String(userId || '').trim(),
    actionType: String(actionType).trim().toUpperCase(),
    targetEntityId: String(targetEntityId || '').trim(),
    targetEntityType: String(targetEntityType || '').trim(),
    details,
    reason: String(reason || '').trim(),
    timestamp: new Date(),
    ipAddress: String(ipAddress || '').trim(),
  });

  return toPlainObject(auditLog);
};

const listAuditLogs = async (query = {}) => {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = parsePositiveInteger(query.limit, 20, 'limit', 100);
  const skip = (page - 1) * limit;
  const filter = {};

  if (query.actionType?.trim()) {
    filter.actionType = query.actionType.trim().toUpperCase();
  }

  const adminUserId = query.adminUserId?.trim() || query.adminId?.trim();
  if (adminUserId) {
    filter.adminUserId = adminUserId;
  }

  if (query.userId?.trim()) {
    filter.userId = query.userId.trim();
  }

  if (query.targetEntityType?.trim()) {
    filter.targetEntityType = query.targetEntityType.trim();
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  const plainItems = items.map(toPlainObject);
  const userIds = [...new Set(plainItems.flatMap((i) => [i.adminUserId, i.userId]).filter(Boolean))];
  const userRecords = userIds.length
    ? await User.find({ userId: { $in: userIds } }).select('userId firstName lastName').lean()
    : [];
  const nameMap = Object.fromEntries(
    userRecords.map((u) => [u.userId, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.userId])
  );

  return {
    items: plainItems.map((i) => ({
      ...i,
      adminName: nameMap[i.adminUserId] || i.adminUserId || '—',
      targetUserName: nameMap[i.userId] || i.userId || '',
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

module.exports = {
  createAuditLog,
  listAuditLogs,
};