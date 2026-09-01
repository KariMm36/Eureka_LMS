import { ApiError } from '../utils/apiError.js';
import { logger } from '../config/logger.config.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;
  const isProduction = process.env.NODE_ENV === 'production';

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = ApiError.badRequest('حجم الملف المرفوع أكبر من الحد المسموح به');
    } else {
      error = ApiError.badRequest(`خطأ في رفع الملف: ${err.message}`);
    }
  } else if (err.code === 'P2003') {
    error = ApiError.badRequest('أحد المعرفات المدخلة (المرحلة أو الصف أو المادة) غير موجود أو غير مرتبط بشكل صحيح');
  } else if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : (err.meta?.target || '');
    error = ApiError.conflict(`القيمة المدخلة مستخدمة بالفعل ${target ? `(${target})` : ''}`);
  } else if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const rawMessage = error.message || 'حدث خطأ غير متوقع في الخادم';
    error = new ApiError(statusCode, rawMessage, error?.errors || [], err.stack);
  }

  // 1. Log full internal error server-side with correlation requestId
  if (error.statusCode >= 500) {
    logger.error({
      err: error,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      ip: req.ip,
    }, `[Server Error] ${error.message}`);
  } else if (!isProduction) {
    logger.warn({
      statusCode: error.statusCode,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      message: error.message,
    }, `[Client Error] ${error.message}`);
  }

  // 2. Sanitize error message for production clients on unexpected 500 errors
  let safeMessage = error.message;
  if (isProduction && error.statusCode >= 500 && !(err instanceof ApiError)) {
    safeMessage = 'حدث خطأ غير متوقع في الخادم';
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: safeMessage,
    ...(error.errors?.length > 0 && { errors: error.errors }),
    ...(!isProduction && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};

