import { ApiError } from '../utils/apiError.js';

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('غير مصرح بالدخول'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('ليس لديك الصلاحية الكافية لإتمام هذا الإجراء'));
    }

    next();
  };
};

export const requireRole = authorize;

