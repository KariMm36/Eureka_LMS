export class ApiError extends Error {
  constructor(statusCode, message = 'حدث خطأ ما', errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = 'بيانات غير صالحة', errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'غير مصرح بالدخول') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'ليس لديك صلاحية الوصول لهذا المورد') {
    return new ApiError(403, message);
  }

  static notFound(message = 'المورد المطلوب غير موجود') {
    return new ApiError(404, message);
  }

  static conflict(message = 'المورد موجود بالفعل') {
    return new ApiError(409, message);
  }

  static internal(message = 'حدث خطأ في الخادم') {
    return new ApiError(500, message);
  }
}
