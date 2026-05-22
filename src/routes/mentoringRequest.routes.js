const express = require('express');

const mentoringRequestController = require('../controllers/mentoringRequest.controller');
const protect = require('../middleware/auth.middleware');
const uploadProof = require('../middleware/uploadProof.middleware');
const validate = require('../middleware/validate.middleware');
const {
  submitMentoringRequestSchema,
} = require('../validators/mentoringRequest.validator');

const router = express.Router();

router.use(protect);

router.post('/', uploadProof, validate(submitMentoringRequestSchema), mentoringRequestController.submit);
router.get('/my', mentoringRequestController.getMyRequests);

module.exports = router;
