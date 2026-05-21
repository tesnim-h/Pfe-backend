const Joi = require('joi');

const projectStatusSchema = Joi.string()
  .trim()
  .uppercase()
  .valid('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

const createProjectSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required(),
  description: Joi.string().trim().allow('').max(5000).default(''),
  requiredSkill: Joi.string().trim().allow('').max(100).optional(),
  categoryId: Joi.string().trim().allow('').optional(),
  status: projectStatusSchema.default('OPEN'),
});

const updateProjectSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).optional(),
  description: Joi.string().trim().allow('').max(5000).optional(),
  requiredSkill: Joi.string().trim().allow('').max(100).optional(),
  categoryId: Joi.string().trim().allow('').optional(),
  status: projectStatusSchema.optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field is required',
  });

module.exports = {
  createProjectSchema,
  updateProjectSchema,
};
