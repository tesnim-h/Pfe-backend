const projectService = require('../services/project.service');
const ApiResponse = require('../utils/ApiResponse');

const createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject(req.user, req.body);
    res.status(201).json(new ApiResponse(201, project, 'Project created successfully'));
  } catch (error) {
    next(error);
  }
};

const listProjects = async (req, res, next) => {
  try {
    const result = await projectService.listProjects(req.query);
    res.status(200).json(new ApiResponse(200, result, 'Projects fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const listProjectCategories = async (req, res, next) => {
  try {
    const categories = await projectService.listProjectCategories();
    res.status(200).json(new ApiResponse(200, categories, 'Project categories fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const listJoinRequests = async (req, res, next) => {
  try {
    const requests = await projectService.listJoinRequests(req.user, req.params.id);
    res.status(200).json(new ApiResponse(200, requests, 'Join requests fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    res.status(200).json(new ApiResponse(200, project, 'Project fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await projectService.updateProject(req.user, req.params.id, req.body);
    res.status(200).json(new ApiResponse(200, project, 'Project updated successfully'));
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await projectService.deleteProject(req.user, req.params.id);
    res.status(200).json(new ApiResponse(200, project, 'Project deleted successfully'));
  } catch (error) {
    next(error);
  }
};

const joinProject = async (req, res, next) => {
  try {
    const project = await projectService.joinProject(req.user, req.params.id);
    res.status(200).json(new ApiResponse(200, project, 'Join request submitted successfully'));
  } catch (error) {
    next(error);
  }
};

const approveJoinRequest = async (req, res, next) => {
  try {
    const project = await projectService.approveJoinRequest(
      req.user,
      req.params.id,
      req.params.userId
    );
    res.status(200).json(new ApiResponse(200, project, 'Join request approved successfully'));
  } catch (error) {
    next(error);
  }
};

const rejectJoinRequest = async (req, res, next) => {
  try {
    const project = await projectService.rejectJoinRequest(
      req.user,
      req.params.id,
      req.params.userId
    );
    res.status(200).json(new ApiResponse(200, project, 'Join request rejected successfully'));
  } catch (error) {
    next(error);
  }
};

const leaveProject = async (req, res, next) => {
  try {
    const project = await projectService.leaveProject(req.user, req.params.id);
    res.status(200).json(new ApiResponse(200, project, 'Left project successfully'));
  } catch (error) {
    next(error);
  }
};

const removeProjectMember = async (req, res, next) => {
  try {
    const project = await projectService.removeProjectMember(
      req.user,
      req.params.id,
      req.params.userId
    );
    res.status(200).json(new ApiResponse(200, project, 'Project member removed successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  listProjects,
  listProjectCategories,
  listJoinRequests,
  getProjectById,
  updateProject,
  deleteProject,
  joinProject,
  approveJoinRequest,
  rejectJoinRequest,
  leaveProject,
  removeProjectMember,
};
