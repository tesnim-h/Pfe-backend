const Joi = require('joi');

// Payload contract for POST /sessions/open (public host-created sessions).
const createPublicSessionSchema = Joi.object({
  title: Joi.string().trim().min(3).max(160).required(),
  description: Joi.string().trim().allow('').max(2000).optional(),
  categoryId: Joi.string().trim().allow('').optional(),
  duration: Joi.number().positive().max(4).optional(),
  date: Joi.date().iso().required(),
  googleMeetLink: Joi.string().trim().uri().allow('').optional(),
});

// Payload contract for POST /sessions/request.
const createSessionRequestSchema = Joi.object({
  teacherId: Joi.string().trim().required(),
  skill: Joi.string().trim().min(2).max(120).required(),
  categoryId: Joi.string().trim().allow('').optional(),
  duration: Joi.number().positive().required(),
  date: Joi.date().iso().required(),
  message: Joi.string().trim().allow('').max(1000).optional(),
});

// Payload contract for PATCH /sessions/:id/complete.
const completeSessionSchema = Joi.object({
  actualDuration: Joi.number().positive().optional(),
});

module.exports = {
  createPublicSessionSchema,
  createSessionRequestSchema,
  completeSessionSchema,
};
