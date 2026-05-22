const Joi = require('joi');

const submitMentoringRequestSchema = Joi.object({
  skillId: Joi.string().trim().optional(),
  portfolioLink: Joi.string().trim().uri().allow('').optional(),
  requestNote: Joi.string().trim().allow('').max(1000).optional(),
});

const approveMentoringRequestSchema = Joi.object({
  approvalScore: Joi.number().min(0).max(100).required(),
  approvalFeedback: Joi.string().trim().allow('').max(1000).optional(),
});

const rejectMentoringRequestSchema = Joi.object({
  rejectionReason: Joi.string().trim().allow('').max(1000).optional(),
});

const listMentoringRequestsSchema = Joi.object({
  status: Joi.string()
    .trim()
    .uppercase()
    .valid('PENDING', 'APPROVED', 'REJECTED', 'ALL')
    .optional(),
});

module.exports = {
  submitMentoringRequestSchema,
  approveMentoringRequestSchema,
  rejectMentoringRequestSchema,
  listMentoringRequestsSchema,
};
