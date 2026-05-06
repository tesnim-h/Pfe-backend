const Joi = require('joi');

const updateMeSchema = Joi.object({
  name: Joi.string().trim().max(101).optional(),
  firstName: Joi.string().trim().max(50).optional(),
  lastName: Joi.string().trim().max(50).optional(),
  email: Joi.string().email().trim().lowercase().optional(),
  bio: Joi.string().allow('').max(500).optional(),
  portfolioUrl: Joi.string().trim().uri().allow('').optional(),
  cityId: Joi.string().trim().allow('').optional(),
  resumeFileName: Joi.string().trim().max(255).allow('').optional(),
  resumeFileDataUrl: Joi.string().trim().allow('').optional(),
  removeResume: Joi.boolean().optional(),
  languages: Joi.alternatives()
    .try(Joi.array().items(Joi.string().trim()), Joi.string().allow(''))
    .optional(),
  avatar: Joi.string().trim().uri().optional(),
  photo: Joi.string().trim().uri().optional(),
  profilePicture: Joi.string().trim().uri().optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field is required',
  });

const skillValueSchema = Joi.string().trim().min(1).max(100);

const manageUserSkillSchema = Joi.object({
  skill: skillValueSchema.optional(),
  skillName: skillValueSchema.optional(),
})
  .or('skill', 'skillName')
  .messages({
    'object.missing': 'Skill name is required',
  });

module.exports = {
  updateMeSchema,
  manageUserSkillSchema,
};
