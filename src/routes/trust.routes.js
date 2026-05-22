const express = require('express');

const trustController = require('../controllers/trust.controller');
const protect = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { grantEndorsementSchema } = require('../validators/trust.validator');

const router = express.Router();

router.use(protect);

// Public trust profiles (read-only, no mutation)
router.get('/skills/:userId', trustController.getPublicSkillTrustProfiles);
router.get('/skills/:userId/:skillId', trustController.getSkillTrustProfile);

// Endorsement management
router.post('/endorse', validate(grantEndorsementSchema), trustController.grantEndorsement);
router.get('/endorsements/received', trustController.getReceivedEndorsements);
router.get('/endorsable-projects', trustController.getEndorsableProjects);

module.exports = router;
