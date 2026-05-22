const trustService = require('../services/trust.service');
const ApiResponse = require('../utils/ApiResponse');

// GET /trust/skills/:userId — public trust profiles for all validated skills of a user.
const getPublicSkillTrustProfiles = async (req, res, next) => {
  try {
    const profiles = await trustService.getPublicSkillTrustProfiles(req.params.userId);
    res.status(200).json(new ApiResponse(200, profiles, 'Trust profiles fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /trust/skills/:userId/:skillId — single skill trust profile.
const getSkillTrustProfile = async (req, res, next) => {
  try {
    const profile = await trustService.getSkillTrustProfile(req.params.userId, req.params.skillId);
    res.status(200).json(new ApiResponse(200, profile, 'Skill trust profile fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// POST /trust/endorse — grant an endorsement after confirmed project collaboration.
const grantEndorsement = async (req, res, next) => {
  try {
    const result = await trustService.grantEndorsement(req.user, req.body);
    res.status(201).json(new ApiResponse(201, result, 'Endorsement granted successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /trust/endorsements/received — endorsements received by the authenticated user.
const getReceivedEndorsements = async (req, res, next) => {
  try {
    const endorsements = await trustService.getReceivedEndorsements(req.user.userId);
    res.status(200).json(new ApiResponse(200, endorsements, 'Endorsements fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /trust/endorsable-projects?toUserId=... — completed projects shared with another user.
const getEndorsableProjects = async (req, res, next) => {
  try {
    const projects = await trustService.getEndorsableProjects(req.user.userId, req.query.toUserId);
    res.status(200).json(new ApiResponse(200, projects, 'Endorsable projects fetched successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicSkillTrustProfiles,
  getSkillTrustProfile,
  grantEndorsement,
  getReceivedEndorsements,
  getEndorsableProjects,
};
