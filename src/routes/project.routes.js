const express = require('express');

const projectController = require('../controllers/project.controller');
const protect = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createProjectSchema, updateProjectSchema } = require('../validators/project.validator');

const router = express.Router();

router.use(protect);

router.get('/', projectController.listProjects);
router.get('/categories', projectController.listProjectCategories);
router.get('/:id', projectController.getProjectById);
router.get('/:id/requests', projectController.listJoinRequests);
router.post('/', validate(createProjectSchema), projectController.createProject);
router.post('/:id/join', projectController.joinProject);
router.post('/:id/requests/:userId/approve', projectController.approveJoinRequest);
router.post('/:id/requests/:userId/reject', projectController.rejectJoinRequest);
router.post('/:id/leave', projectController.leaveProject);
router.delete('/:id/members/:userId', projectController.removeProjectMember);
router.put('/:id', validate(updateProjectSchema), projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
