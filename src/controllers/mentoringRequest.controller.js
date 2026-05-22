const mentoringRequestService = require('../services/mentoringRequest.service');
const ApiResponse = require('../utils/ApiResponse');

// POST /mentoring-requests
const submit = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (req.file) {
      payload.proofFileName = req.file.originalname;
      payload.proofStoredName = req.file.filename;
      payload.proofMimeType = req.file.mimetype;
    }
    const request = await mentoringRequestService.submitMentoringRequest(req.user, payload);
    res.status(201).json(new ApiResponse(201, request, 'Mentoring request submitted successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /mentoring-requests/my
const getMyRequests = async (req, res, next) => {
  try {
    const data = await mentoringRequestService.getMyMentoringRequests(req.user, req.query);
    res.status(200).json(new ApiResponse(200, data, 'Mentoring requests fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// GET /admin/mentoring-requests
const listRequests = async (req, res, next) => {
  try {
    const data = await mentoringRequestService.listMentoringRequests(req.query);
    res.status(200).json(new ApiResponse(200, data, 'Mentoring requests fetched successfully'));
  } catch (error) {
    next(error);
  }
};

// PATCH /admin/mentoring-requests/:id/approve
const approveRequest = async (req, res, next) => {
  try {
    const data = await mentoringRequestService.approveMentoringRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.status(200).json(new ApiResponse(200, data, 'Mentoring request approved successfully'));
  } catch (error) {
    next(error);
  }
};

// PATCH /admin/mentoring-requests/:id/reject
const rejectRequest = async (req, res, next) => {
  try {
    const data = await mentoringRequestService.rejectMentoringRequest(
      req.user,
      req.params.id,
      req.body
    );
    res.status(200).json(new ApiResponse(200, data, 'Mentoring request rejected successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = { submit, getMyRequests, listRequests, approveRequest, rejectRequest };
