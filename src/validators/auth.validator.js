const Joi = require('joi');

const {
  ADMIN_PERMISSION_KEYS,
  PUBLIC_REGISTERABLE_ROLES,
} = require('../constants/admin');

const adminPermissionSchema = Joi.string().trim().valid(...ADMIN_PERMISSION_KEYS);

const registerSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
  firstName: Joi.string().trim().max(50).optional(),
  lastName: Joi.string().trim().max(50).optional(),
  profilePicture: Joi.string().trim().uri().optional(),
  bio: Joi.string().max(500).optional(),
  countryId: Joi.string().trim().optional(),
  cityId: Joi.string().trim().optional(),
  languages: Joi.array().items(Joi.string().trim()).default([]),
  role: Joi.string().valid(...PUBLIC_REGISTERABLE_ROLES).default('LEARNER'),
});

const registerAdminSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().min(8).max(128).required(),
  firstName: Joi.string().trim().max(50).optional(),
  lastName: Joi.string().trim().max(50).optional(),
  profilePicture: Joi.string().trim().uri().optional(),
  bio: Joi.string().max(500).optional(),
  countryId: Joi.string().trim().optional(),
  cityId: Joi.string().trim().optional(),
  languages: Joi.array().items(Joi.string().trim()).default([]),
  permissions: Joi.array().items(adminPermissionSchema).min(1).unique().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().required(),
});

module.exports = {
  registerSchema,
  registerAdminSchema,
  loginSchema,
};
