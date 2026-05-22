const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const {
  registerSchema,
  registerAdminSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

// Tighter limit for reset flows to slow down brute-force and abuse attempts.
// Disabled in development so you can test freely without waiting.
const resetLimiter = process.env.NODE_ENV === 'production'
  ? rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many attempts. Please try again in an hour.',
          },
        });
      },
    })
  : (req, res, next) => next();

router.post('/register', validate(registerSchema), authController.register);
router.post('/register-admin', validate(registerAdminSchema), authController.registerAdmin);
router.post('/login', validate(loginSchema), authController.login);
router.post('/forgot-password', resetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', resetLimiter, validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
