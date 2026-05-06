const userService = require('../services/user.service');
const ratingService = require('../services/rating.service');
const ApiResponse = require('../utils/ApiResponse');

const getMe = async (req, res, next) => {
  try {
    const user = userService.getCurrentUser(req.user);
    res.status(200).json(new ApiResponse(200, user, 'Current user fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getOfferedSkills = async (req, res, next) => {
  try {
    const skills = userService.getCurrentUserOfferedSkills(req.user);
    res.status(200).json(new ApiResponse(200, skills, 'Offered skills fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getWantedSkills = async (req, res, next) => {
  try {
    const skills = userService.getCurrentUserWantedSkills(req.user);
    res.status(200).json(new ApiResponse(200, skills, 'Wanted skills fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getAlgerianCities = async (req, res, next) => {
  try {
    const cities = await userService.listAlgerianCities();
    res.status(200).json(new ApiResponse(200, cities, 'Algerian cities fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateUserProfile(req.user.userId, req.body);
    res.status(200).json(new ApiResponse(200, user, 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.status(200).json(new ApiResponse(200, user, 'Public profile fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getUserRatings = async (req, res, next) => {
  try {
    // Returns profile-ready rating summary (avg + reviews).
    const ratings = await ratingService.getRatingsForUser(req.params.id);
    res.status(200).json(new ApiResponse(200, ratings, 'User ratings fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const result = await userService.searchUsers(req.query);
    res.status(200).json(new ApiResponse(200, result, 'Users fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const addOfferedSkill = async (req, res, next) => {
  try {
    const user = await userService.addSkillOffered(req.user.userId, req.body);
    res.status(200).json(new ApiResponse(200, user, 'Offered skill added successfully'));
  } catch (error) {
    next(error);
  }
};

const removeOfferedSkill = async (req, res, next) => {
  try {
    const user = await userService.removeSkillOffered(req.user.userId, req.body);
    res.status(200).json(new ApiResponse(200, user, 'Offered skill removed successfully'));
  } catch (error) {
    next(error);
  }
};

const addWantedSkill = async (req, res, next) => {
  try {
    const user = await userService.addSkillWanted(req.user.userId, req.body);
    res.status(200).json(new ApiResponse(200, user, 'Wanted skill added successfully'));
  } catch (error) {
    next(error);
  }
};

const removeWantedSkill = async (req, res, next) => {
  try {
    const user = await userService.removeSkillWanted(req.user.userId, req.body);
    res.status(200).json(new ApiResponse(200, user, 'Wanted skill removed successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  getOfferedSkills,
  getWantedSkills,
  getAlgerianCities,
  updateMe,
  getUserById,
  getUserRatings,
  listUsers,
  addOfferedSkill,
  removeOfferedSkill,
  addWantedSkill,
  removeWantedSkill,
};
