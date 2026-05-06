const express = require('express');

const dashboardController = require('../controllers/dashboard.controller');
const protect = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createValidationRequestSchema } = require('../validators/dashboard.validator');

const router = express.Router();

router.use(protect);

router.get('/overview', dashboardController.getOverview);
router.get('/profile', dashboardController.getProfile);
router.get('/explore', dashboardController.getExploreDirectory);
router.get('/validation', dashboardController.getValidationData);
router.post(
  '/validation-requests',
  validate(createValidationRequestSchema),
  dashboardController.createValidationRequest
);

module.exports = router;
