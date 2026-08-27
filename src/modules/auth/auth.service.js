import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { signToken, verifyToken, signRefreshToken, verifyRefreshToken, hashRefreshToken } from '../../utils/jwt.util.js';
import { generateOTP } from '../../utils/otp.util.js';
import { sendEmail } from '../../config/mailer.config.js';
import { ENV } from '../../config/env.config.js';
import { getWelcomeEmailTemplate, getOtpEmailTemplate, getVerifyEmailTemplate } from '../../utils/emailTemplates.js';
import { logger } from '../../config/logger.config.js';

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

    // Generate tokens
    const token = signToken({ id: user.id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id });

    // Store hashed refresh token (SHA256 pre-hashed to prevent bcrypt 72-byte truncation)
    const refreshTokenHash = await bcrypt.hash(hashRefreshToken(refreshToken), 8);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    // Generate and send verification OTP
    const otpCode = generateOTP(6);
    const expiresAt = new Date(Date.now() + ENV.OTP_EXPIRES_MINUTES * 60 * 1000);
    await prisma.oTP.create({
      data: {
        email: user.email,
        userId: user.id,
        otpCode,
        type: 'VERIFY_ACCOUNT',
        expiresAt,
      },
    });

    // Send Verification Email + Welcome Email asynchronously
    sendEmail({
      to: user.email,
      subject: 'تأكيد بريدك الإلكتروني - منصة يوريكا 🎉',
      text: `مرحباً ${user.fullName}، رمز تأكيد حسابك هو: ${otpCode}. ينتهي الرمز خلال ${ENV.OTP_EXPIRES_MINUTES} دقائق.`,
      html: getVerifyEmailTemplate({
        fullName: user.fullName,
        otpCode,
        expiresInMinutes: ENV.OTP_EXPIRES_MINUTES,
      }),
    }).catch((err) => console.error('Failed to send verification email on register:', err.message));

    const { password: _, refreshTokenHash: __, ...userWithoutSensitive } = user;

    return {
      user: userWithoutSensitive,
      token,
      refreshToken,
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
    const refreshToken = signRefreshToken({ id: user.id });

    // Hash & store refresh token in DB (SHA256 pre-hashed to prevent bcrypt 72-byte truncation)
    const refreshTokenHash = await bcrypt.hash(hashRefreshToken(refreshToken), 8);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    const { password: _, refreshTokenHash: __, ...userWithoutSensitive } = user;

    return {
      user: userWithoutSensitive,
      token,
      refreshToken,
    };
  }

  static async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Anti-enumeration: return uniform success response without disclosing account presence
      return {
        email: email.toLowerCase(),
        expiresInMinutes: ENV.OTP_EXPIRES_MINUTES,
        message: 'إذا كان البريد الإلكتروني مسجلاً لدينا، فسيتم إرسال رمز التحقق إليه',
      };
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

    // Send styled OTP Email with resilient error handling to preserve anti-enumeration
    try {
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
    } catch (mailError) {
      logger.error({
        err: mailError,
        email: email.toLowerCase(),
      }, `[ForgotPassword] Failed to dispatch OTP email to ${email}`);
    }

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

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: {
        isUsed: true,
      },
    });

    // Generate short-lived reset token bound to this otpRecord.id session
    const resetToken = signToken(
      { email: email.toLowerCase(), purpose: 'RESET_PASSWORD', resetSessionId: otpRecord.id },
      '15m'
    );

    return {
      message: 'تم التحقق من الرمز بنجاح',
      resetToken,
    };
  }

  static async resetPassword({ email, resetToken, newPassword }) {
    // Verify the resetToken is structurally valid and was issued for THIS email
    let decoded;
    try {
      decoded = verifyToken(resetToken);
    } catch (err) {
      throw ApiError.badRequest('رمز إعادة التعيين غير صالح أو انتهت صلاحيته. يرجى طلب رمز جديد');
    }

    if (decoded.purpose !== 'RESET_PASSWORD') {
      throw ApiError.badRequest('رمز إعادة التعيين غير صالح');
    }

    if (decoded.email !== email.toLowerCase()) {
      throw ApiError.badRequest('البريد الإلكتروني لا يتطابق مع رمز إعادة التعيين');
    }

    if (!decoded.resetSessionId) {
      throw ApiError.badRequest('رمز إعادة التعيين غير صالح أو قديم');
    }

    // Verify single-use: check that the active reset session exists in the DB
    const activeOtpSession = await prisma.oTP.findFirst({
      where: {
        id: decoded.resetSessionId,
        email: email.toLowerCase(),
        type: 'FORGOT_PASSWORD',
        isUsed: true,
      },
    });

    if (!activeOtpSession) {
      throw ApiError.badRequest('رمز إعادة التعيين تم استخدامه مسبقاً أو غير صالح. يرجى طلب رمز جديد');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Atomically update password AND revoke the reset session by deleting it (prevents replay)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      }),
      prisma.oTP.deleteMany({
        where: { email: email.toLowerCase(), type: 'FORGOT_PASSWORD' },
      }),
    ]);

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

  /**
   * Refresh Access Token using a valid Refresh Token
   * Mobile clients call this when their access token expires (every 15 mins)
   */
  static async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw ApiError.unauthorized('رمز التحديث غير موجود');
    }

    // Verify the refresh token is structurally valid
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw ApiError.unauthorized('رمز التحديث غير صالح أو انتهت صلاحيته. يرجى تسجيل الدخول مجدداً');
    }

    // Fetch the user and their stored refresh token hash
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true, refreshTokenHash: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw ApiError.unauthorized('الجلسة غير صالحة. يرجى تسجيل الدخول مجدداً');
    }

    // Compare the incoming token against the stored hash
    const isValid = await bcrypt.compare(hashRefreshToken(refreshToken), user.refreshTokenHash);
    if (!isValid) {
      throw ApiError.unauthorized('رمز التحديث غير مطابق. يرجى تسجيل الدخول مجدداً');
    }

    // Issue a new short-lived access token + new refresh token (Rotation)
    const newAccessToken = signToken({ id: user.id, role: user.role, email: user.email });
    const newRefreshToken = signRefreshToken({ id: user.id });

    // Store new hashed refresh token in DB, immediately revoking the old token
    const newRefreshTokenHash = await bcrypt.hash(hashRefreshToken(newRefreshToken), 8);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ENV.JWT_EXPIRES_IN,
    };
  }

  /**
   * Logout — invalidate refresh token by clearing it from DB
   */
  static async logout(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { message: 'تم تسجيل الخروج بنجاح' };
  }

  /**
   * Request / Resend Email Verification OTP
   */
  static async sendVerificationEmail(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    if (user.isVerified) {
      throw ApiError.badRequest('البريد الإلكتروني مفعّل بالفعل');
    }

    const otpCode = generateOTP(6);
    const expiresAt = new Date(Date.now() + ENV.OTP_EXPIRES_MINUTES * 60 * 1000);

    // Invalidate old verification OTPs
    await prisma.oTP.deleteMany({
      where: { userId: user.id, type: 'VERIFY_ACCOUNT' },
    });

    await prisma.oTP.create({
      data: {
        email: user.email,
        userId: user.id,
        otpCode,
        type: 'VERIFY_ACCOUNT',
        expiresAt,
      },
    });

    await sendEmail({
      to: user.email,
      subject: 'تأكيد بريدك الإلكتروني - تطبيق يوريكا',
      text: `رمز التحقق الخاص بك هو: ${otpCode}. ينتهي الرمز خلال ${ENV.OTP_EXPIRES_MINUTES} دقائق.`,
      html: getVerifyEmailTemplate({
        fullName: user.fullName,
        otpCode,
        expiresInMinutes: ENV.OTP_EXPIRES_MINUTES,
      }),
    });

    return {
      email: user.email,
      expiresInMinutes: ENV.OTP_EXPIRES_MINUTES,
    };
  }

  /**
   * Verify Email using OTP Code
   */
  static async verifyEmail({ userId, otpCode }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    if (user.isVerified) {
      return { message: 'البريد الإلكتروني مفعّل بالفعل', isVerified: true };
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId,
        otpCode,
        type: 'VERIFY_ACCOUNT',
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw ApiError.badRequest('رمز التحقق غير صحيح أو انتهت صلاحيته');
    }

    // Mark OTP as used and update user verification status
    await prisma.$transaction([
      prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { isVerified: true },
      }),
    ]);

    return {
      message: 'تم تفعيل وتأكيد البريد الإلكتروني بنجاح 🎉',
      isVerified: true,
    };
  }

  /**
   * Delete Account (Self-service account deletion)
   */
  static async deleteAccount(userId, password) {
    if (!password) {
      throw ApiError.badRequest('كلمة المرور مطلوبة لتأكيد حذف الحساب');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw ApiError.badRequest('كلمة المرور غير صحيحة');
    }

    // Delete user (Prisma cascade relations will clean up StudentProfile, OTPs, Notifications)
    await prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'تم حذف الحساب وجميع البيانات المرتبطة به بنجاح' };
  }
}



