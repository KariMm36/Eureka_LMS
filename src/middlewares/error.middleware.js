import { ApiError } from '../utils/apiError.js';
import { logger } from '../config/logger.config.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'حدث خطأ غير متوقع في الخادم';
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  // Log 500 server errors with context
  if (error.statusCode >= 500) {
    logger.error({
      err: error,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      ip: req.ip,
    }, `[Server Error] ${error.message}`);
  } else if (process.env.NODE_ENV === 'development') {
    logger.warn({
      statusCode: error.statusCode,
      method: req.method,
      url: req.originalUrl,
      message: error.message,
    }, `[Client Error] ${error.message}`);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    ...(error.errors?.length > 0 && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};

