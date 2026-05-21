const express = require('express');

const controller = require('../controllers/mentorApplication.controller');
const protect = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.post('/', controller.submit);
router.get('/me', controller.getMyApplication);

module.exports = router;
