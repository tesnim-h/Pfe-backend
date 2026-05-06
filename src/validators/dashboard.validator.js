const Joi = require('joi');

const createValidationRequestSchema = Joi.object({
  skillId: Joi.string().trim().empty('').optional(),
  skillName: Joi.string().trim().empty('').max(120).optional(),
  mentorUserId: Joi.string().trim().required(),
  portfolioLink: Joi.string().trim().uri().allow('').optional(),
  note: Joi.string().trim().allow('').max(1000).optional(),
})
  .or('skillId', 'skillName')
  .messages({
    'object.missing': 'A skill id or skill name is required',
  });

module.exports = {
  createValidationRequestSchema,
};
