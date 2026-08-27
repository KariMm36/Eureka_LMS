import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/apiError.js';

const isProduction = process.env.NODE_ENV === 'production';

// 1. General Auth Rate Limiter (Login & Register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 15 : 10000, // 15 in prod, 10,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('تم تجاوز الحد المسموح من المحاولات، يرجى المحاولة بعد 15 دقيقة'));
  },
});

// 2. Forgot Password Request Limiter (Prevents OTP/Email spam)
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 3 : 5000, // 3 in prod, 5,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('لقد قمت بطلب رمز التحقق عدة مرات، يرجى الانتظار بضع دقائق'));
  },
});

// 3. OTP Verification Limiter (Prevents OTP brute force)
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 5 : 5000, // 5 in prod, 5,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('تم تجاوز عدد محاولات إدخال الرمز، يرجى طلب رمز جديد'));
  },
});

// 4. Group Code Joining Limiter (Prevents invite code scanning)
export const groupJoinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isProduction ? 10 : 5000, // 10 in prod, 5,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('يرجى الانتظار قليلاً قبل محاولة إدخال كود جديد'));
  },
});
