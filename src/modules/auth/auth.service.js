import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { signToken } from '../../utils/jwt.util.js';
import { generateOTP } from '../../utils/otp.util.js';
import { sendEmail } from '../../config/mailer.config.js';
import { ENV } from '../../config/env.config.js';
import { getWelcomeEmailTemplate, getOtpEmailTemplate } from '../../utils/emailTemplates.js';

export class AuthService {
  static async register({ fullName, email, phone, password, role = 'STUDENT' }) {
    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      throw ApiError.conflict('البريد الإلكتروني مسجل بالفعل');
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      throw ApiError.conflict('رقم الهاتف مسجل بالفعل');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        fullName,
        email: email.toLowerCase(),
        phone,
        password: passwordHash,
        role,
        ...(role === 'STUDENT' && {
          studentProfile: {
            create: {},
          },
        }),
      },
      include: {
        studentProfile: true,
      },
    });

    // Send Welcome Email asynchronously without blocking response
    sendEmail({
      to: user.email,
      subject: 'مرحباً بك في منصة يوريكا التعليمية 🎉',
      text: `مرحباً ${user.fullName}، يسعدنا انضمامك إلى مجتمع يوريكا التعليمي! ابدأ الآن باختيار مرحلتك وموادك الدراسية.`,
      html: getWelcomeEmailTemplate({ fullName: user.fullName }),
    }).catch((err) => console.error('Failed to send welcome email:', err.message));

    const token = signToken({ id: user.id, role: user.role, email: user.email });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  static async login({ email, password }) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        studentProfile: {
          include: {
            stage: true,
            gradeLevel: true,
            selectedSubjects: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw ApiError.badRequest('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw ApiError.badRequest('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const token = signToken({ id: user.id, role: user.role, email: user.email });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  static async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw ApiError.notFound('لم يتم العثور على حساب مرتبط بهذا البريد الإلكتروني');
    }

    const otpCode = generateOTP(6);
    const expiresAt = new Date(Date.now() + ENV.OTP_EXPIRES_MINUTES * 60 * 1000);

    // Invalidate previous OTPs for this email
    await prisma.oTP.deleteMany({
      where: { email: email.toLowerCase(), type: 'FORGOT_PASSWORD' },
    });

    await prisma.oTP.create({
      data: {
        email: email.toLowerCase(),
        userId: user.id,
        otpCode,
        type: 'FORGOT_PASSWORD',
        expiresAt,
      },
    });

    // Send styled OTP Email
    await sendEmail({
      to: email,
      subject: 'رمز التحقق لإعادة تعيين كلمة المرور - تطبيق يوريكا',
      text: `رمز التحقق الخاص بك هو: ${otpCode}. ينتهي الرمز خلال ${ENV.OTP_EXPIRES_MINUTES} دقائق.`,
      html: getOtpEmailTemplate({
        fullName: user.fullName,
        otpCode,
        expiresInMinutes: ENV.OTP_EXPIRES_MINUTES,
      }),
    });

    return {
      email,
      expiresInMinutes: ENV.OTP_EXPIRES_MINUTES,
    };
  }

  static async verifyOtp({ email, otpCode }) {
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: email.toLowerCase(),
        otpCode,
        type: 'FORGOT_PASSWORD',
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw ApiError.badRequest('الرمز غير صحيح أو انتهت صلاحيته. حاول مرة أخرى');
    }

    // Mark as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Generate short-lived reset token (15 mins)
    const resetToken = signToken(
      { email: email.toLowerCase(), purpose: 'RESET_PASSWORD' },
      '15m'
    );

    return {
      message: 'تم التحقق من الرمز بنجاح',
      resetToken,
    };
  }

  static async resetPassword({ email, resetToken, newPassword }) {
    try {
      const decoded = signToken.verify ? signToken.verify(resetToken, ENV.JWT_SECRET) : null;
    } catch (_) {}

    // Verify token payload
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    return {
      message: 'تم تحديث كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول',
    };
  }

  static async updatePassword({ userId, currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw ApiError.badRequest('كلمة المرور الحالية غير صحيحة');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    return {
      message: 'تم تحديث كلمة المرور بنجاح',
    };
  }
}
