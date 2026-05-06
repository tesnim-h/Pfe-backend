const dashboardService = require('../services/dashboard.service');
const ApiResponse = require('../utils/ApiResponse');

const getOverview = async (req, res, next) => {
  try {
    const overview = await dashboardService.getOverview(req.user);
    res.status(200).json(new ApiResponse(200, overview, 'Dashboard overview fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await dashboardService.getProfile(req.user);
    res.status(200).json(new ApiResponse(200, profile, 'Dashboard profile fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getExploreDirectory = async (req, res, next) => {
  try {
    const directory = await dashboardService.getExploreDirectory(req.user);
    res.status(200).json(new ApiResponse(200, directory, 'Explore directory fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getValidationData = async (req, res, next) => {
  try {
    const validationData = await dashboardService.getValidationData(req.user);
    res.status(200).json(new ApiResponse(200, validationData, 'Validation data fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const createValidationRequest = async (req, res, next) => {
  try {
    const request = await dashboardService.createValidationRequest(req.user, req.body);
    res.status(201).json(new ApiResponse(201, request, 'Validation request created successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getProfile,
  getExploreDirectory,
  getValidationData,
  createValidationRequest,
};
