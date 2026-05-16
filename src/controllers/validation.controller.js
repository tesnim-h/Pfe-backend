const validationService = require('../services/validation.service');
const ApiResponse = require('../utils/ApiResponse');

const listMentorValidationRequests = async (req, res, next) => {
  try {
    const data = await validationService.listMentorValidationRequests(req.user, req.query);
    res
      .status(200)
      .json(new ApiResponse(200, data, 'Mentor validation requests fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const acceptValidationRequest = async (req, res, next) => {
  try {
    const data = await validationService.acceptValidationRequest(
      req.user,
      req.params.requestId,
      req.body
    );
    res.status(200).json(new ApiResponse(200, data, 'Validation request accepted successfully'));
  } catch (error) {
    next(error);
  }
};

const rejectValidationRequest = async (req, res, next) => {
  try {
    const data = await validationService.rejectValidationRequest(
      req.user,
      req.params.requestId,
      req.body
    );
    res.status(200).json(new ApiResponse(200, data, 'Validation request rejected successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listMentorValidationRequests,
  acceptValidationRequest,
  rejectValidationRequest,
};
