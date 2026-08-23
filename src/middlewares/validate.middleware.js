import { ApiError } from '../utils/apiError.js';

export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorDetails = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/['"]/g, ''),
    }));

    return next(ApiError.badRequest('خطأ في التحقق من صحة البيانات', errorDetails));
  }

  req.body = value;
  next();
};
