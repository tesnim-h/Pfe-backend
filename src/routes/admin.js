const express = require('express');

const adminController = require('../controllers/adminController');
const adminSkillsController = require('../controllers/adminSkills.controller');
const requireAdminPermissions = require('../middleware/admin-permissions.middleware');
const protect = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/authorize');
const validate = require('../middleware/validate.middleware');
const mentorApplicationController = require('../controllers/mentorApplication.controller');
const mentoringRequestController = require('../controllers/mentoringRequest.controller');
const {
  approveMentoringRequestSchema,
  rejectMentoringRequestSchema,
} = require('../validators/mentoringRequest.validator');
const {
  updatePermissionsSchema,
  updateReportSchema,
  updateRoleSchema,
  updateSettingSchema,
  updateStatusSchema,
  updateUserByAdminSchema,
} = require('../validators/admin.validator');
const {
  createCategorySchema,
  updateCategorySchema,
  createSkillDefinitionSchema,
  updateSkillDefinitionSchema,
} = require('../validators/admin-skills.validator');

const router = express.Router();

router.use(protect);
router.use(authorizeRoles('admin', 'ADMIN'));

router.get('/dashboard', requireAdminPermissions('view_dashboard'), adminController.getDashboard);
router.get('/audit-logs', requireAdminPermissions('view_audit_logs'), adminController.getAuditLogs);
router.get('/reports', requireAdminPermissions('review_reports'), adminController.getReports);
router.patch(
  '/reports/:id',
  requireAdminPermissions('review_reports'),
  validate(updateReportSchema),
  adminController.updateReport
);
router.get('/settings', requireAdminPermissions('manage_settings'), adminController.getSettings);
router.put(
  '/settings/:key',
  requireAdminPermissions('manage_settings'),
  validate(updateSettingSchema),
  adminController.updateSetting
);
router.get('/users', requireAdminPermissions('manage_users'), adminController.getAllUsers);
router.get('/users/:id', requireAdminPermissions('manage_users'), adminController.getSingleUser);
router.put(
  '/users/:id',
  requireAdminPermissions('manage_users'),
  validate(updateUserByAdminSchema),
  adminController.updateUser
);
router.delete('/users/:id', requireAdminPermissions('manage_users'), adminController.deleteUser);
router.patch(
  '/users/:id/role',
  requireAdminPermissions('manage_admins'),
  validate(updateRoleSchema),
  adminController.updateUserRole
);
router.patch(
  '/users/:id/permissions',
  requireAdminPermissions('manage_admins'),
  validate(updatePermissionsSchema),
  adminController.updateUserPermissions
);
router.patch(
  '/users/:id/status',
  requireAdminPermissions('moderate_users'),
  validate(updateStatusSchema),
  adminController.updateUserStatus
);

// Skill categories
router.get(
  '/skills/categories',
  requireAdminPermissions('manage_categories'),
  adminSkillsController.listCategories
);
router.post(
  '/skills/categories',
  requireAdminPermissions('manage_categories'),
  validate(createCategorySchema),
  adminSkillsController.createCategory
);
router.put(
  '/skills/categories/:id',
  requireAdminPermissions('manage_categories'),
  validate(updateCategorySchema),
  adminSkillsController.updateCategory
);
router.delete(
  '/skills/categories/:id',
  requireAdminPermissions('manage_categories'),
  adminSkillsController.deleteCategory
);

// Skill definitions
router.get(
  '/skills/definitions',
  requireAdminPermissions('manage_categories'),
  adminSkillsController.listSkillDefinitions
);
router.post(
  '/skills/definitions',
  requireAdminPermissions('manage_categories'),
  validate(createSkillDefinitionSchema),
  adminSkillsController.createSkillDefinition
);
router.put(
  '/skills/definitions/:id',
  requireAdminPermissions('manage_categories'),
  validate(updateSkillDefinitionSchema),
  adminSkillsController.updateSkillDefinition
);
router.delete(
  '/skills/definitions/:id',
  requireAdminPermissions('manage_categories'),
  adminSkillsController.deleteSkillDefinition
);

// Mentor applications
router.get(
  '/mentor-applications',
  requireAdminPermissions('verify_mentors'),
  mentorApplicationController.listApplications
);
router.patch(
  '/mentor-applications/:id/review',
  requireAdminPermissions('verify_mentors'),
  mentorApplicationController.reviewApplication
);

// Mentoring requests
router.get(
  '/mentoring-requests',
  requireAdminPermissions('verify_mentors'),
  mentoringRequestController.listRequests
);
router.patch(
  '/mentoring-requests/:id/approve',
  requireAdminPermissions('verify_mentors'),
  validate(approveMentoringRequestSchema),
  mentoringRequestController.approveRequest
);
router.patch(
  '/mentoring-requests/:id/reject',
  requireAdminPermissions('verify_mentors'),
  validate(rejectMentoringRequestSchema),
  mentoringRequestController.rejectRequest
);

module.exports = router;
