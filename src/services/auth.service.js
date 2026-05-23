const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const CreditBalance = require('../models/CreditBalance');
const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/hash');
const { signAccessToken } = require('../utils/jwt');
const { generateOtp, hashOtp } = require('../utils/token');
const { sanitizeUser } = require('./user.service');
const SystemSettings = require('../models/SystemSettings');
const { DEFAULT_ADMIN_PERMISSIONS } = require('../constants/admin');

const DEFAULT_INITIAL_TIME_CREDITS = '10';

async function getInitialTimeCredits() {
  const setting = await SystemSettings.findOne({ settingKey: 'initial_credit_allocation' });
  const value = parseFloat(setting?.settingValue);
  return (Number.isFinite(value) && value >= 0) ? String(value) : DEFAULT_INITIAL_TIME_CREDITS;
}

const buildInitialCreditBalancePayload = ({ userId, initialCredits }) => {
  const initialCreditAmount = Number(initialCredits);

  return {
    balanceId: `BAL-${randomUUID()}`,
    userId,
    currentBalance: initialCreditAmount,
    totalEarned: initialCreditAmount,
    totalSpent: 0,
    lastUpdated: new Date(),
    updatedBy: userId,
  };
};

const buildAuthPayload = (user) => {
  return {
    user: sanitizeUser(user),
    accessToken: signAccessToken({
      sub: user.userId,
      role: user.role,
    }),
  };
};

const register = async (payload) => {
  const existingUser = await User.findOne({ email: payload.email });

  if (existingUser) {
    throw new ApiError(409, 'Email already in use', 'EMAIL_ALREADY_EXISTS');
  }

  const initialCredits = await getInitialTimeCredits();

  const user = await User.create({
    userId: `USR-${randomUUID()}`,
    email: payload.email,
    passwordHash: await hashPassword(payload.password),
    firstName: payload.firstName,
    lastName: payload.lastName,
    profilePicture: payload.profilePicture,
    bio: payload.bio,
    countryId: payload.countryId,
    cityId: payload.cityId,
    languages: payload.languages || [],
    role: payload.role || 'LEARNER',
    timeCredits: mongoose.Types.Decimal128.fromString(initialCredits),
  });

  await CreditBalance.create(
    buildInitialCreditBalancePayload({
      userId: user.userId,
      initialCredits,
    })
  );

  return buildAuthPayload(user);
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new ApiError(403, 'Account is not active', 'ACCOUNT_NOT_ACTIVE');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  user.lastLogin = new Date();
  await user.save();

  return buildAuthPayload(user);
};


const registerAdmin = async (payload, options = {}) => {
  const bootstrapSecret = String(options.bootstrapSecret || '').trim();
  const expectedSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || '').trim();

  if (!expectedSecret || bootstrapSecret !== expectedSecret) {
    throw new ApiError(403, 'Invalid admin bootstrap secret', 'INVALID_ADMIN_BOOTSTRAP_SECRET');
  }

  const existingUser = await User.findOne({ email: payload.email });

  if (existingUser) {
    throw new ApiError(409, 'Email already in use', 'EMAIL_ALREADY_EXISTS');
  }

  const initialCredits = await getInitialTimeCredits();

  const user = await User.create({
    userId: `USR-${randomUUID()}`,
    email: payload.email,
    passwordHash: await hashPassword(payload.password),
    firstName: payload.firstName,
    lastName: payload.lastName,
    profilePicture: payload.profilePicture,
    bio: payload.bio,
    countryId: payload.countryId,
    cityId: payload.cityId,
    languages: payload.languages || [],
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
    emailVerified: true,
    timeCredits: mongoose.Types.Decimal128.fromString(initialCredits),
  });

  await CreditBalance.create(
    buildInitialCreditBalancePayload({
      userId: user.userId,
      initialCredits,
    })
  );

  await Admin.create({
    userId: user.userId,
    assignedSkillCategoryId: '',
    skillName: '',
    permissions: payload.permissions?.length ? payload.permissions : DEFAULT_ADMIN_PERMISSIONS,
    assignedDate: new Date(),
    lastActiveDate: new Date(),
  });

  await AuditLog.create({
    auditId: `AUD-${randomUUID()}`,
    adminUserId: user.userId,
    userId: user.userId,
    actionType: 'CREATE_ADMIN',
    targetEntityId: user.userId,
    targetEntityType: 'User',
    details: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    reason: 'Admin bootstrap registration',
    timestamp: new Date(),
    ipAddress: String(options.ipAddress || '').trim(),
  });

  return buildAuthPayload(user);
};

module.exports = {
  register,
  registerAdmin,
  login,
};
