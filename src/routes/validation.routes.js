const express = require('express');

const validationController = require('../controllers/validation.controller');
const protect = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const {
  acceptValidationRequestSchema,
  rejectValidationRequestSchema,
} = require('../validators/validation.validator');

const router = express.Router();

router.use(protect);

router.get('/mentor/requests', validationController.listMentorValidationRequests);
router.patch(
  '/mentor/requests/:requestId/accept',
  validate(acceptValidationRequestSchema),
  validationController.acceptValidationRequest
);
router.patch(
  '/mentor/requests/:requestId/reject',
  validate(rejectValidationRequestSchema),
  validationController.rejectValidationRequest
);

module.exports = router;
