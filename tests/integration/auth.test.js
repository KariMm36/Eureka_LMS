import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';
import { signToken } from '../../src/utils/jwt.util.js';

describe('Auth Module Integration Tests', () => {
  const helper = new TestSetupHelper('auth_suite');
  const timestamp = Date.now();

  const testStudentData = {
    fullName: 'طالب اختبارات المصادقة',
    email: `auth.student.${timestamp}@eureka-test.com`,
    phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    role: 'STUDENT',
  };

  let accessToken = '';
  let refreshToken = '';
  let studentUserId = '';

  beforeAll(async () => {
    await helper.cleanup();
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  describe('1. Registration Flow (POST /api/v1/auth/register)', () => {
    it('should register student, return tokens, and generate verification OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testStudentData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testStudentData.email.toLowerCase());
      expect(res.body.data.user.isVerified).toBe(false); // Default is false before OTP confirmation
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      studentUserId = res.body.data.user.id;
      accessToken = res.body.data.token;
      refreshToken = res.body.data.refreshToken;
      helper.createdUserIds.add(studentUserId);

      // Verify OTP was stored in DB with type VERIFY_ACCOUNT
      const otpRecord = await prisma.oTP.findFirst({
        where: { userId: studentUserId, type: 'VERIFY_ACCOUNT' },
      });
      expect(otpRecord).not.toBeNull();
      expect(otpRecord.otpCode.length).toBe(6);
    });

    it('should reject duplicate email (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testStudentData);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('البريد الإلكتروني مسجل بالفعل');
    });

    it('should reject invalid Egyptian phone format (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testStudentData,
          email: `invalid.phone.${Date.now()}@eureka-test.com`,
          phone: '0223456789', // Invalid (not 010/011/012/015)
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('رقم هاتف مصري صحيح');
    });
  });

  describe('2. Email Verification Flow (POST /api/v1/auth/verify-email)', () => {
    it('should reject invalid or expired OTP code (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ otpCode: '999999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('رمز التحقق غير صحيح');
    });

    it('should verify email and flip isVerified to true with valid OTP', async () => {
      const otpRecord = await prisma.oTP.findFirst({
        where: { userId: studentUserId, type: 'VERIFY_ACCOUNT', isUsed: false },
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ otpCode: otpRecord.otpCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isVerified).toBe(true);

      // Verify user in DB
      const updatedUser = await prisma.user.findUnique({ where: { id: studentUserId } });
      expect(updatedUser.isVerified).toBe(true);
    });
  });


  describe('3. Login Flow (POST /api/v1/auth/login)', () => {
    it('should login with correct credentials and issue fresh tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testStudentData.email,
          password: testStudentData.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testStudentData.email.toLowerCase());

      accessToken = res.body.data.token;
      refreshToken = res.body.data.refreshToken;
    });

    it('should reject login with incorrect password (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testStudentData.email,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    });
  });

  describe('4. Token Refresh Flow (POST /api/v1/auth/refresh)', () => {
    it('should issue new access token and rotated refresh token when provided valid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.expiresIn).toBeDefined();

      // Update test refreshToken to the rotated token
      refreshToken = res.body.data.refreshToken;
    });

    it('should reject refresh with malformed or tampered token (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'malformed.token.value' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Password Reset & Bypass Protection (POST /api/v1/auth/reset-password)', () => {
    let validResetToken = '';

    it('should request forgot password OTP and verify to get a valid resetToken', async () => {
      // Step A: Request OTP
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testStudentData.email });

      const otpRecord = await prisma.oTP.findFirst({
        where: { email: testStudentData.email.toLowerCase(), type: 'FORGOT_PASSWORD', isUsed: false },
      });

      // Step B: Verify OTP to get resetToken
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: testStudentData.email,
          otpCode: otpRecord.otpCode,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.resetToken).toBeDefined();
      validResetToken = verifyRes.body.data.resetToken;
    });

    it('SECURITY TEST: should reject valid JWT with WRONG email (Cross-account attack bypass)', async () => {
      // Create a validly signed JWT with purpose RESET_PASSWORD, but for a DIFFERENT email
      const forgedResetToken = signToken(
        { email: 'attacker@other.com', purpose: 'RESET_PASSWORD' },
        '15m'
      );

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testStudentData.email,
          resetToken: forgedResetToken,
          newPassword: 'BrandNewPassword123!',
          confirmPassword: 'BrandNewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('البريد الإلكتروني لا يتطابق');
    });

    it('SECURITY TEST: should reject valid JWT with WRONG purpose claim (Token reuse attack)', async () => {
      // Create a validly signed JWT for the same user, but with wrong purpose claim
      const wrongPurposeToken = signToken(
        { email: testStudentData.email.toLowerCase(), purpose: 'AUTH_LOGIN' },
        '15m'
      );

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testStudentData.email,
          resetToken: wrongPurposeToken,
          newPassword: 'BrandNewPassword123!',
          confirmPassword: 'BrandNewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('رمز إعادة التعيين غير صالح');
    });

    it('should successfully reset password with the legitimate resetToken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testStudentData.email,
          resetToken: validResetToken,
          newPassword: 'BrandNewPassword123!',
          confirmPassword: 'BrandNewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login with new password succeeds
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testStudentData.email,
          password: 'BrandNewPassword123!',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeDefined();
    });
  });

  describe('6. Protected Routes & Logout (GET /me & POST /logout)', () => {
    it('should fetch user details when authenticated', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(studentUserId);
    });

    it('should reject request with missing Authorization header (401)', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should logout and invalidate refresh token', async () => {
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutRes.status).toBe(200);

      // Refresh token is now rejected
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });

    it('should delete authenticated user account (DELETE /api/v1/auth/account)', async () => {
      const deleteRes = await request(app)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'BrandNewPassword123!' });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify user no longer exists in DB
      const userInDb = await prisma.user.findUnique({
        where: { id: studentUserId },
      });
      expect(userInDb).toBeNull();
    });
  });
});

