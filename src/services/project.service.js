const { randomUUID } = require('crypto');

const Project = require('../models/Project');
const SkillCategory = require('../models/SkillCategory');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');

const PROJECT_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const ensureAuthenticatedUser = (user) => {
  if (!user?.userId) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  return user;
};

const normalizeProjectId = (projectId) => {
  const normalizedProjectId = projectId?.trim();

  if (!normalizedProjectId) {
    throw new ApiError(400, 'Project id is required', 'VALIDATION_ERROR');
  }

  return normalizedProjectId;
};

const normalizeUserId = (userId) => {
  const normalizedUserId = userId?.trim();

  if (!normalizedUserId) {
    throw new ApiError(400, 'User id is required', 'VALIDATION_ERROR');
  }

  return normalizedUserId;
};

const parsePositiveInteger = (value, fallback, fieldName, maxValue = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiError(400, `${fieldName} must be a positive integer`, 'VALIDATION_ERROR');
  }

  return Math.min(parsed, maxValue);
};

const sanitizeProject = (project) => {
  return project?.toObject ? project.toObject() : { ...project };
};

const getProjectMemberIndex = (project, userId) => {
  const members = project.members || [];

  return members.findIndex((member) => member.userId === userId);
};

const getProjectJoinRequestIndex = (project, userId) => {
  const requests = project.joinRequests || [];

  return requests.findIndex((request) => request.userId === userId);
};

const getProjectDocumentById = async (projectId) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  const project = await Project.findOne({ projectId: normalizedProjectId });

  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return project;
};

const ensureProjectOwner = (project, userId) => {
  if (project.ownerId !== userId) {
    throw new ApiError(403, 'You are not allowed to modify this project', 'FORBIDDEN');
  }
};

const createProject = async (currentUser, payload) => {
  const user = ensureAuthenticatedUser(currentUser);
  const project = await Project.create({
    projectId: `PRJ-${randomUUID()}`,
    ownerId: user.userId,
    title: payload.title,
    description: payload.description || '',
    requiredSkill: payload.requiredSkill || '',
    categoryId: payload.categoryId || '',
    status: payload.status || 'OPEN',
    members: [],
  });

  return sanitizeProject(project);
};

const listProjects = async (query = {}) => {
  const q = query.q?.trim();
  const ownerId = query.ownerId?.trim();
  const memberId = query.memberId?.trim();
  const status = query.status?.trim().toUpperCase();
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = parsePositiveInteger(query.limit, 20, 'limit', 100);

  const categoryId = query.categoryId?.trim();

  const filter = {};

  if (ownerId) {
    filter.ownerId = ownerId;
  }

  if (memberId) {
    filter['members.userId'] = memberId;
  }

  if (categoryId) {
    filter.categoryId = categoryId;
  }

  if (status) {
    if (!PROJECT_STATUSES.includes(status)) {
      throw new ApiError(400, 'Invalid project status filter', 'VALIDATION_ERROR');
    }

    filter.status = status;
  }

  if (q) {
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedQuery, 'i');

    filter.$or = [
      { projectId: searchRegex },
      { title: searchRegex },
      { description: searchRegex },
      { requiredSkill: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Project.countDocuments(filter),
  ]);

  return {
    items: items.map(sanitizeProject),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

const getProjectById = async (projectId) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  const project = await Project.findOne({ projectId: normalizedProjectId }).lean();

  if (!project) {
    throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return sanitizeProject(project);
};

const updateProject = async (currentUser, projectId, payload) => {
  const user = ensureAuthenticatedUser(currentUser);
  const project = await getProjectDocumentById(projectId);

  ensureProjectOwner(project, user.userId);

  if (payload.title !== undefined) {
    project.title = payload.title;
  }

  if (payload.description !== undefined) {
    project.description = payload.description;
  }

  if (payload.requiredSkill !== undefined) {
    project.requiredSkill = payload.requiredSkill;
  }

  if (payload.categoryId !== undefined) {
    project.categoryId = payload.categoryId;
  }

  if (payload.status !== undefined) {
    project.status = payload.status;
  }

  await project.save();

  return sanitizeProject(project);
};

const deleteProject = async (currentUser, projectId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const project = await getProjectDocumentById(projectId);

  ensureProjectOwner(project, user.userId);
  await project.deleteOne();

  return sanitizeProject(project);
};

const joinProject = async (currentUser, projectId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const project = await getProjectDocumentById(projectId);

  if (project.ownerId === user.userId) {
    throw new ApiError(
      400,
      'Project owner cannot request to join their own project',
      'OWNER_CANNOT_JOIN_PROJECT'
    );
  }

  if (getProjectMemberIndex(project, user.userId) !== -1) {
    throw new ApiError(409, 'You are already a member of this project', 'PROJECT_MEMBER_EXISTS');
  }

  if (getProjectJoinRequestIndex(project, user.userId) !== -1) {
    throw new ApiError(409, 'Join request already pending', 'PROJECT_JOIN_REQUEST_EXISTS');
  }

  project.joinRequests.push({
    userId: user.userId,
    requestedAt: new Date(),
  });

  await project.save();

  await Notification.create({
    notificationId: `NOTIF-${randomUUID()}`,
    userId: project.ownerId,
    notificationType: 'VALIDATION_REQUEST',
    title: 'New project join request',
    description: `${user.userId} has requested to join your project ${project.title || project.projectId}.`,
    relatedEntityId: project.projectId,
  });

  return sanitizeProject(project);
};

const approveJoinRequest = async (currentUser, projectId, memberUserId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const normalizedMemberUserId = normalizeUserId(memberUserId);
  const project = await getProjectDocumentById(projectId);

  ensureProjectOwner(project, user.userId);

  const requestIndex = getProjectJoinRequestIndex(project, normalizedMemberUserId);

  if (requestIndex === -1) {
    throw new ApiError(404, 'Join request not found', 'PROJECT_JOIN_REQUEST_NOT_FOUND');
  }

  if (getProjectMemberIndex(project, normalizedMemberUserId) !== -1) {
    project.joinRequests.splice(requestIndex, 1);
    await project.save();
    return sanitizeProject(project);
  }

  project.joinRequests.splice(requestIndex, 1);
  project.members.push({
    userId: normalizedMemberUserId,
    joinedAt: new Date(),
  });

  await project.save();

  return sanitizeProject(project);
};

const rejectJoinRequest = async (currentUser, projectId, memberUserId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const normalizedMemberUserId = normalizeUserId(memberUserId);
  const project = await getProjectDocumentById(projectId);

  ensureProjectOwner(project, user.userId);

  const requestIndex = getProjectJoinRequestIndex(project, normalizedMemberUserId);

  if (requestIndex === -1) {
    throw new ApiError(404, 'Join request not found', 'PROJECT_JOIN_REQUEST_NOT_FOUND');
  }

  project.joinRequests.splice(requestIndex, 1);
  await project.save();

  return sanitizeProject(project);
};

const leaveProject = async (currentUser, projectId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const project = await getProjectDocumentById(projectId);

  if (project.ownerId === user.userId) {
    throw new ApiError(
      400,
      'Project owner cannot leave an owned project',
      'OWNER_CANNOT_LEAVE_PROJECT'
    );
  }

  const memberIndex = getProjectMemberIndex(project, user.userId);

  if (memberIndex === -1) {
    throw new ApiError(404, 'You are not a member of this project', 'PROJECT_MEMBER_NOT_FOUND');
  }

  project.members.splice(memberIndex, 1);
  await project.save();

  return sanitizeProject(project);
};

const removeProjectMember = async (currentUser, projectId, memberUserId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const normalizedMemberUserId = normalizeUserId(memberUserId);
  const project = await getProjectDocumentById(projectId);

  ensureProjectOwner(project, user.userId);

  if (normalizedMemberUserId === project.ownerId) {
    throw new ApiError(400, 'Project owner cannot be removed', 'OWNER_CANNOT_BE_REMOVED');
  }

  const memberIndex = getProjectMemberIndex(project, normalizedMemberUserId);

  if (memberIndex === -1) {
    throw new ApiError(404, 'Project member not found', 'PROJECT_MEMBER_NOT_FOUND');
  }

  project.members.splice(memberIndex, 1);
  await project.save();

  return sanitizeProject(project);
};

const listProjectCategories = async () => {
  return SkillCategory.find({ isActive: true }).sort({ categoryName: 1 }).lean();
};

const listJoinRequests = async (currentUser, projectId) => {
  const user = ensureAuthenticatedUser(currentUser);
  const project = await getProjectDocumentById(projectId);

  ensureProjectOwner(project, user.userId);

  return sanitizeProject(project).joinRequests || [];
};

module.exports = {
  createProject,
  listProjects,
  listProjectCategories,
  getProjectById,
  updateProject,
  deleteProject,
  joinProject,
  approveJoinRequest,
  rejectJoinRequest,
  leaveProject,
  removeProjectMember,
  listJoinRequests,
};
