const ADMIN_PERMISSION_KEYS = Object.freeze([
  'manage_users',
  'manage_admins',
  'moderate_users',
  'review_reports',
  'verify_mentors',
  'manage_categories',
  'manage_settings',
  'view_dashboard',
  'view_audit_logs',
]);

const DEFAULT_ADMIN_PERMISSIONS = Object.freeze([...ADMIN_PERMISSION_KEYS]);

const ADMIN_ROLE_VALUES = Object.freeze(['admin', 'ADMIN']);
const ADMIN_ASSIGNABLE_ROLES = Object.freeze(['user', 'admin', 'LEARNER', 'MENTOR', 'ADMIN']);
const USER_ACCOUNT_STATUSES = Object.freeze(['ACTIVE', 'BANNED']);
const REPORT_STATUSES = Object.freeze(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']);
const PUBLIC_REGISTERABLE_ROLES = Object.freeze(['LEARNER', 'MENTOR']);

module.exports = {
  ADMIN_PERMISSION_KEYS,
  DEFAULT_ADMIN_PERMISSIONS,
  ADMIN_ROLE_VALUES,
  ADMIN_ASSIGNABLE_ROLES,
  USER_ACCOUNT_STATUSES,
  REPORT_STATUSES,
  PUBLIC_REGISTERABLE_ROLES,
};
