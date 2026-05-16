const Joi = require('joi');

const acceptValidationRequestSchema = Joi.object({
  validationScore: Joi.number().min(0).max(100).required(),
  validationFeedback: Joi.string().trim().allow('').max(1000).optional(),
});

const rejectValidationRequestSchema = Joi.object({
  rejectionReason: Joi.string().trim().allow('').max(1000).optional(),
});

const listMentorValidationRequestsSchema = Joi.object({
  status: Joi.string()
    .trim()
    .uppercase()
    .valid('PENDING', 'IN_REVIEW', 'VALIDATED', 'REJECTED')
    .optional(),
});

module.exports = {
  acceptValidationRequestSchema,
  rejectValidationRequestSchema,
  listMentorValidationRequestsSchema,
};
