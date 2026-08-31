import { ApiError } from '../utils/apiError.js';
import { verifyToken } from '../utils/jwt.util.js';
import prisma from '../config/prisma.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('يجب تسجيل الدخول للوصول إلى هذه الصفحة');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('رمز الدخول غير صالح');
    }

    const decoded = verifyToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        isVerified: true,
        isActive: true,
        tokenVersion: true,
        studentProfile: {
          include: {
            stage: true,
            gradeLevel: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.unauthorized('المستخدم لم يعد موجوداً');
    }

    if (user.isActive === false) {
      throw ApiError.forbidden('تم إيقاف هذا الحساب من قِبل إدارة المنصة');
    }

    // Token version check — invalidates tokens issued before last logout
    if (decoded.tv !== undefined && decoded.tv !== user.tokenVersion) {
      throw ApiError.unauthorized('انتهت صلاحية جلسة الدخول، يرجى تسجيل الدخول مرة أخرى');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('رمز الدخول غير صالح أو تالف'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('انتهت صلاحية جلسة الدخول، يرجى تسجيل الدخول مرة أخرى'));
    }
    next(error);
  }
};
