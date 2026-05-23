const adminService = require('../services/admin.service');
const ApiResponse = require('../utils/ApiResponse');

const getRequestMeta = (req) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  return {
    ipAddress: forwardedFor || req.ip || '',
  };
};

const getAllUsers = async (req, res, next) => {
  try {
    const result = await adminService.listUsers(req.query);
    res.status(200).json(new ApiResponse(200, result, 'Users fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getSingleUser = async (req, res, next) => {
  try {
    const user = await adminService.getSingleUser(req.params.id);
    res.status(200).json(new ApiResponse(200, user, 'User fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await adminService.updateUser(req.params.id, req.body, req.user, getRequestMeta(req));
    res.status(200).json(new ApiResponse(200, user, 'User updated successfully'));
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const deleted = await adminService.deleteUser(req.params.id, req.user, getRequestMeta(req));
    res.status(200).json(new ApiResponse(200, deleted, 'User deleted successfully'));
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const user = await adminService.updateUserRole(
      req.params.id,
      req.body.role,
      req.user,
      getRequestMeta(req)
    );
    res.status(200).json(new ApiResponse(200, user, 'User role updated successfully'));
  } catch (error) {
    next(error);
  }
};

const updateUserPermissions = async (req, res, next) => {
  try {
    const user = await adminService.updateUserPermissions(
      req.params.id,
      req.body.permissions,
      req.user,
      getRequestMeta(req)
    );
    res.status(200).json(new ApiResponse(200, user, 'Admin permissions updated successfully'));
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const user = await adminService.updateUserStatus(
      req.params.id,
      req.body,
      req.user,
      getRequestMeta(req)
    );
    res.status(200).json(new ApiResponse(200, user, 'User status updated successfully'));
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await adminService.getDashboard();
    res.status(200).json(new ApiResponse(200, dashboard, 'Admin dashboard fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const result = await adminService.getAuditLogs(req.query);
    res.status(200).json(new ApiResponse(200, result, 'Audit logs fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const result = await adminService.listReports(req.query);
    res.status(200).json(new ApiResponse(200, result, 'Reports fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const updateReport = async (req, res, next) => {
  try {
    const report = await adminService.updateReport(
      req.params.id,
      req.body,
      req.user,
      getRequestMeta(req)
    );
    res.status(200).json(new ApiResponse(200, report, 'Report updated successfully'));
  } catch (error) {
    next(error);
  }
};

const deleteSetting = async (req, res, next) => {
  try {
    const result = await adminService.deleteSetting(req.params.key, req.user, getRequestMeta(req));
    res.status(200).json(new ApiResponse(200, result, 'Setting deleted successfully'));
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const settings = await adminService.listSettings();
    res.status(200).json(new ApiResponse(200, settings, 'System settings fetched successfully'));
  } catch (error) {
    next(error);
  }
};

const updateSetting = async (req, res, next) => {
  try {
    const setting = await adminService.updateSetting(
      req.params.key,
      req.body,
      req.user,
      getRequestMeta(req)
    );
    res.status(200).json(new ApiResponse(200, setting, 'System setting updated successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  updateUserRole,
  updateUserPermissions,
  updateUserStatus,
  getDashboard,
  getAuditLogs,
  getReports,
  updateReport,
  getSettings,
  updateSetting,
  deleteSetting,
};
