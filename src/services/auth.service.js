const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/hash');
const { signAccessToken } = require('../utils/jwt');
const { generateResetToken, hashToken } = require('../utils/token');
const { sanitizeUser } = require('./user.service');
const sendEmail = require('../utils/email');
const SystemSettings = require('../models/SystemSettings');
const { DEFAULT_ADMIN_PERMISSIONS } = require('../constants/admin');

const DEFAULT_INITIAL_TIME_CREDITS = '10';

async function getInitialTimeCredits() {
  const setting = await SystemSettings.findOne({ settingKey: 'initial_credit_allocation' });
  const value = parseFloat(setting?.settingValue);
  return (Number.isFinite(value) && value >= 0) ? String(value) : DEFAULT_INITIAL_TIME_CREDITS;
}

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

const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  const genericMessage = 'If that email exists, a reset link has been sent.';

  // Return a generic message regardless of whether the email exists.
  // Revealing whether an email is registered is an enumeration vulnerability.
  if (!user) {
    return { message: genericMessage };
  }

  const { plainToken, hashedToken, expires } = generateResetToken();

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = expires;
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${plainToken}`;

  try {
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. This link expires in 10 minutes:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    });

    if (emailResult?.delivery === 'console') {
      return {
        message:
          'SMTP is not configured in development. The reset link was generated locally and printed in the backend console.',
        debugResetUrl: resetUrl,
      };
    }
  } catch (emailError) {
    console.error('[EMAIL ERROR]', emailError.message);
    // Roll back the token so the user can retry - a dangling token with no
    // delivered email would lock them out until it expires.
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(500, 'Failed to send reset email. Please try again.', 'EMAIL_SEND_FAILED');
  }

  return { message: genericMessage };
};

const resetPassword = async (plainToken, newPassword) => {
  const hashedToken = hashToken(plainToken);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new ApiError(400, 'Invalid or expired token', 'INVALID_RESET_TOKEN');
  }

  // Hash manually - the model has no pre-save hook; this mirrors how register() works.
  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save({ validateBeforeSave: false });

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
  forgotPassword,
  resetPassword,
};
