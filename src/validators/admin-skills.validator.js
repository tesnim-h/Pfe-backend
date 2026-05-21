const Joi = require('joi');

const createCategorySchema = Joi.object({
  categoryName: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().trim().allow('').max(500).default(''),
  parentCategoryId: Joi.string().trim().allow('').optional(),
  iconUrl: Joi.string().trim().allow('').optional(),
});

const updateCategorySchema = Joi.object({
  categoryName: Joi.string().trim().min(2).max(80).optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  parentCategoryId: Joi.string().trim().allow('').optional(),
  iconUrl: Joi.string().trim().allow('').optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field is required' });

const createSkillDefinitionSchema = Joi.object({
  skillName: Joi.string().trim().min(2).max(100).required(),
  categoryId: Joi.string().trim().required(),
  description: Joi.string().trim().allow('').max(500).default(''),
});

const updateSkillDefinitionSchema = Joi.object({
  skillName: Joi.string().trim().min(2).max(100).optional(),
  categoryId: Joi.string().trim().optional(),
  description: Joi.string().trim().allow('').max(500).optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field is required' });

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createSkillDefinitionSchema,
  updateSkillDefinitionSchema,
};
