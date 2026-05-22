const mentorApplicationService = require('../services/mentorApplication.service');
const ApiResponse = require('../utils/ApiResponse');

// POST /mentor-applications
const submit = async (req, res, next) => {
  try {
    const application = await mentorApplicationService.submitMentorApplication(req.user, req.body);
    res.status(201).json(new ApiResponse(201, application, 'Mentorship application submitted'));
  } catch (error) {
    next(error);
  }
};

// GET /mentor-applications/me
const getMyApplication = async (req, res, next) => {
  try {
    const application = await mentorApplicationService.getMyMentorApplication(req.user);
    res.status(200).json(new ApiResponse(200, application, 'Application fetched'));
  } catch (error) {
    next(error);
  }
};

// GET /admin/mentor-applications
const listApplications = async (req, res, next) => {
  try {
    const applications = await mentorApplicationService.listMentorApplications(req.query);
    res.status(200).json(new ApiResponse(200, applications, 'Applications fetched'));
  } catch (error) {
    next(error);
  }
};

// PATCH /admin/mentor-applications/:id/review
const reviewApplication = async (req, res, next) => {
  try {
    const application = await mentorApplicationService.reviewMentorApplication(
      req.user,
      req.params.id,
      req.body
    );
    res.status(200).json(new ApiResponse(200, application, 'Application reviewed'));
  } catch (error) {
    next(error);
  }
};

module.exports = { submit, getMyApplication, listApplications, reviewApplication };
