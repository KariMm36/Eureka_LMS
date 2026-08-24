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
  refreshTokenSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verifyEmailSchema,
} from './auth.validation.js';

const router = Router();


/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new student
 *     tags: [1. Authentication & Verification]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, phone, password, confirmPassword]
 *             properties:
 *               fullName: { type: string, example: "أحمد علي" }
 *               email: { type: string, example: "student@eureka-test.com" }
 *               phone: { type: string, example: "01012345678" }
 *               password: { type: string, example: "Password123!" }
 *               confirmPassword: { type: string, example: "Password123!" }
 *     responses:
 *       201:
 *         description: Student registered successfully and OTP created
 *       400:
 *         description: Validation error or phone format invalid
 *       409:
 *         description: Email or phone already registered
 */
router.post('/register', authLimiter, validate(registerSchema), AuthController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login (Student / Teacher / Admin)
 *     tags: [1. Authentication & Verification]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "student@eureka-test.com" }
 *               password: { type: string, example: "Password123!" }
 *     responses:
 *       200:
 *         description: Login successful, returns access & refresh tokens
 *       400:
 *         description: Invalid email or password
 */
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh expired access token using valid refresh token
 *     tags: [1. Authentication & Verification]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', authLimiter, validate(refreshTokenSchema), AuthController.refreshToken);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Send password reset OTP to email
 *     tags: [1. Authentication & Verification]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: "student@eureka-test.com" }
 *     responses:
 *       200:
 *         description: OTP sent to user email
 *       404:
 *         description: Email not found
 */
router.post('/forgot-password', otpRequestLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP code and receive a signed resetToken
 *     tags: [1. Authentication & Verification]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otpCode]
 *             properties:
 *               email: { type: string, example: "student@eureka-test.com" }
 *               otpCode: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: OTP verified, returns resetToken
 *       400:
 *         description: Invalid or expired OTP code
 */
router.post('/verify-otp', otpVerifyLimiter, validate(verifyOtpSchema), AuthController.verifyOtp);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Set a new password using verified resetToken
 *     tags: [1. Authentication & Verification]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, resetToken, newPassword, confirmPassword]
 *             properties:
 *               email: { type: string, example: "student@eureka-test.com" }
 *               resetToken: { type: string }
 *               newPassword: { type: string, example: "NewPassword123!" }
 *               confirmPassword: { type: string, example: "NewPassword123!" }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid reset token or signature mismatch
 */
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout and revoke active refresh token
 *     tags: [1. Authentication & Verification]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @swagger
 * /auth/send-verification-email:
 *   post:
 *     summary: Send an email verification OTP
 *     tags: [1. Authentication & Verification]
 *     responses:
 *       200:
 *         description: Verification email dispatched
 */
router.post('/send-verification-email', authenticate, otpRequestLimiter, AuthController.sendVerificationEmail);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Confirm email verification OTP
 *     tags: [1. Authentication & Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otpCode]
 *             properties:
 *               otpCode: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/verify-email', authenticate, otpVerifyLimiter, validate(verifyEmailSchema), AuthController.verifyEmail);

/**
 * @swagger
 * /auth/update-password:
 *   put:
 *     summary: Change current password
 *     tags: [1. Authentication & Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *               confirmPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Incorrect current password
 */
router.put('/update-password', authenticate, validate(updatePasswordSchema), AuthController.updatePassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user details
 *     tags: [1. Authentication & Verification]
 *     responses:
 *       200:
 *         description: User profile details
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, AuthController.getMe);

export default router;
