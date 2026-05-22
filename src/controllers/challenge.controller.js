const challengeService = require('../services/challenge.service');

const createChallenge = async (req, res, next) => {
  try {
    const challenge = await challengeService.createChallenge(req.user, req.body);
    res.status(201).json({ success: true, data: challenge });
  } catch (error) {
    next(error);
  }
};

const listChallenges = async (req, res, next) => {
  try {
    const challenges = await challengeService.listChallenges(req.user, req.query);
    res.json({ success: true, data: challenges });
  } catch (error) {
    next(error);
  }
};

const getChallenge = async (req, res, next) => {
  try {
    const challenge = await challengeService.getChallenge(req.user, req.params.id);
    res.json({ success: true, data: challenge });
  } catch (error) {
    next(error);
  }
};

const submitEntry = async (req, res, next) => {
  try {
    const entry = await challengeService.submitEntry(req.user, req.params.id, req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
};

const pickWinners = async (req, res, next) => {
  try {
    const winners = await challengeService.pickWinners(req.user, req.params.id, req.body.entryIds);
    res.json({ success: true, data: winners });
  } catch (error) {
    next(error);
  }
};

const closeChallenge = async (req, res, next) => {
  try {
    const challenge = await challengeService.closeChallenge(req.user, req.params.id);
    res.json({ success: true, data: challenge });
  } catch (error) {
    next(error);
  }
};

const getChallengeLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await challengeService.getChallengeLeaderboard(req.user, req.params.id);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChallenge,
  listChallenges,
  getChallenge,
  submitEntry,
  pickWinners,
  closeChallenge,
  getChallengeLeaderboard,
};
