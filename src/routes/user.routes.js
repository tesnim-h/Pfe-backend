const express = require('express');
const router = express.Router();

const protect = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');
const validate = require('../middleware/validate.middleware');
const { updateMeSchema, manageUserSkillSchema } = require('../validators/user.validator');

router.use(protect);

router.get('/', userController.listUsers);
router.get('/me', userController.getMe);
router.get('/location-options/algeria', userController.getAlgerianCities);
router.get('/me/skills/offered', userController.getOfferedSkills);
router.get('/me/skills/wanted', userController.getWantedSkills);
router.put('/me', validate(updateMeSchema), userController.updateMe);
router.post(
  '/me/skills/offered',
  validate(manageUserSkillSchema),
  userController.addOfferedSkill
);
router.delete(
  '/me/skills/offered',
  validate(manageUserSkillSchema),
  userController.removeOfferedSkill
);
router.post('/me/skills/wanted', validate(manageUserSkillSchema), userController.addWantedSkill);
router.delete(
  '/me/skills/wanted',
  validate(manageUserSkillSchema),
  userController.removeWantedSkill
);
// Public rating summary for a user profile.
router.get('/:id/ratings', userController.getUserRatings);
router.get('/:id', userController.getUserById);

module.exports = router;
