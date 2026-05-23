const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(new ApiResponse(201, result, 'User registered successfully'));
  } catch (error) {
    next(error);
  }
};

const registerAdmin = async (req, res, next) => {
  try {
    const result = await authService.registerAdmin(req.body, {
      bootstrapSecret: req.headers['x-admin-bootstrap-secret'],
      ipAddress: req.ip,
    });
    res.status(201).json(new ApiResponse(201, result, 'Admin registered successfully'));
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(new ApiResponse(200, result, 'Login successful'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  registerAdmin,
  login,
};
