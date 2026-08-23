import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/apiError.js';

// 1. General Auth Rate Limiter (Login & Register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.badRequest('تم تجاوز الحد المسموح من المحاولات، يرجى المحاولة بعد 15 دقيقة'));
  },
});

// 2. Forgot Password Request Limiter (Prevents OTP/Email spam)
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 OTP requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.badRequest('لقد قمت بطلب رمز التحقق عدة مرات، يرجى الانتظار بضع دقائق'));
  },
});

// 3. OTP Verification Limiter (Prevents 6-digit brute force guessing)
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 6, // max 6 incorrect attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.badRequest('تم تجاوز عدد محاولات إدخال الرمز، يرجى طلب رمز جديد'));
  },
});

// 4. Group Code Joining Limiter (Prevents automated group code scraping)
export const groupJoinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // max 10 code checks per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.badRequest('يرجى الانتظار قليلاً قبل محاولة إدخال كود جديد'));
  },
});
