const express = require('express');

const challengeController = require('../controllers/challenge.controller');
const protect = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', challengeController.listChallenges);
router.post('/', challengeController.createChallenge);
router.get('/:id', challengeController.getChallenge);
router.post('/:id/entries', challengeController.submitEntry);
router.get('/:id/leaderboard', challengeController.getChallengeLeaderboard);
router.patch('/:id/winners', challengeController.pickWinners);
router.patch('/:id/close', challengeController.closeChallenge);

module.exports = router;
