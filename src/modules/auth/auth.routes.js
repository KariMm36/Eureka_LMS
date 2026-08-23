import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  authLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} from '../../middlewares/rateLimiter.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updatePasswordSchema,
} from './auth.validation.js';

const router = Router();

// Public Auth Endpoints with Rate Limiting
router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/forgot-password', otpRequestLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/verify-otp', otpVerifyLimiter, validate(verifyOtpSchema), AuthController.verifyOtp);
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);

// Protected Auth Endpoints
router.put('/update-password', authenticate, validate(updatePasswordSchema), AuthController.updatePassword);
router.get('/me', authenticate, AuthController.getMe);

export default router;
