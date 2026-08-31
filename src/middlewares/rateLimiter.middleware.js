import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/apiError.js';

const isProduction = process.env.NODE_ENV === 'production';

// 1. General Auth Rate Limiter (Login & Register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? (parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 100) : 10000, // 100 in prod, 10,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('تم تجاوز الحد المسموح من المحاولات، يرجى المحاولة بعد 15 دقيقة'));
  },
});

// 2. Forgot Password Request Limiter (Prevents OTP/Email spam)
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? (parseInt(process.env.RATE_LIMIT_OTP_REQ_MAX) || 10) : 5000, // 10 in prod, 5,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('لقد قمت بطلب رمز التحقق عدة مرات، يرجى الانتظار بضع دقائق'));
  },
});

// 3. OTP Verification Limiter (Prevents OTP brute force)
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? (parseInt(process.env.RATE_LIMIT_OTP_VERIFY_MAX) || 20) : 5000, // 20 in prod, 5,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('تم تجاوز عدد محاولات إدخال الرمز، يرجى طلب رمز جديد'));
  },
});

// 4. Group Code Joining Limiter (Prevents invite code scanning)
export const groupJoinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isProduction ? (parseInt(process.env.RATE_LIMIT_GROUP_JOIN_MAX) || 60) : 5000, // 60 in prod, 5,000 in dev/test
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ApiError.tooManyRequests('يرجى الانتظار قليلاً قبل محاولة إدخال كود جديد'));
  },
});
