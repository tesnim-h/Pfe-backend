const express = require('express');

const leaderboardController = require('../controllers/leaderboard.controller');
const protect = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/weekly-xp', leaderboardController.getWeeklyXpLeaderboard);

module.exports = router;
