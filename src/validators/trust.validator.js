const Joi = require('joi');

const grantEndorsementSchema = Joi.object({
  toUserId: Joi.string().trim().required(),
  skillId: Joi.string().trim().required(),
  projectId: Joi.string().trim().required(),
});

const getEndorsableProjectsSchema = Joi.object({
  toUserId: Joi.string().trim().required(),
});

module.exports = {
  grantEndorsementSchema,
  getEndorsableProjectsSchema,
};
