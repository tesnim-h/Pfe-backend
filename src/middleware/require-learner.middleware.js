const ApiError = require('../utils/ApiError');

const GUEST_ROLES = new Set(['USER', 'user']);

module.exports = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required', 'AUTH_REQUIRED'));
  }

  if (GUEST_ROLES.has(req.user.role)) {
    return next(
      new ApiError(
        403,
        'Complete your profile to access this feature',
        'PROFILE_INCOMPLETE'
      )
    );
  }

  return next();
};
