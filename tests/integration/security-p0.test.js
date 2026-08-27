import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('P0 Security Vulnerability Remediation Suite', () => {
  let helper;
  let teacherA;
  let teacherB;
  let studentEnrolledA;
  let studentOtherB;
  let groupA;
  let groupB;
  let examA;
  let homeworkA;

  beforeAll(async () => {
    helper = new TestSetupHelper('sec_p0');
    await helper.createAcademicHierarchy();

    teacherA = await helper.createTeacher({ fullName: 'مدرس أ' });
    teacherB = await helper.createTeacher({ fullName: 'مدرس ب' });

    studentEnrolledA = await helper.createStudent({ fullName: 'طالب مسجل في المجموعة أ' });
    studentOtherB = await helper.createStudent({ fullName: 'طالب في المجموعة ب فقط' });

    groupA = await helper.createGroup({ teacherId: teacherA.user.id });
    groupB = await helper.createGroup({ teacherId: teacherB.user.id });

    // Enroll studentEnrolledA ONLY in groupA
    await helper.enrollStudent(studentEnrolledA.user.studentProfile.id, groupA.id);
    // Enroll studentOtherB ONLY in groupB
    await helper.enrollStudent(studentOtherB.user.studentProfile.id, groupB.id);

    // Create Exam in Group A
    examA = await helper.createExam({ groupId: groupA.id });

    // Create Homework in Group A
    homeworkA = await helper.createHomework({ groupId: groupA.id });
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  // =========================================================================
  // VULN-01: Exam Enrollment Access & BOLA Guard
  // =========================================================================
  describe('VULN-01: Student Exam Access & BOLA Protection', () => {
    it('1.1 should allow enrolled student to view exam instructions', async () => {
      const res = await request(app)
        .get(`/api/v1/exams/${examA.id}/instructions`)
        .set('Authorization', `Bearer ${studentEnrolledA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.examId).toBe(examA.id);
    });

    it('1.2 should reject non-enrolled student from viewing exam instructions (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/exams/${examA.id}/instructions`)
        .set('Authorization', `Bearer ${studentOtherB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('أنت لست مسجلاً في مجموعة هذا الامتحان');
    });

    it('1.3 should reject non-enrolled student from starting exam (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${examA.id}/start`)
        .set('Authorization', `Bearer ${studentOtherB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('أنت لست مسجلاً في مجموعة هذا الامتحان');
    });

    it('1.4 should reject non-enrolled student from submitting exam (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${examA.id}/submit`)
        .set('Authorization', `Bearer ${studentOtherB.token}`)
        .send({
          answers: [{ questionOrder: 1, selectedOption: 0 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('أنت لست مسجلاً في مجموعة هذا الامتحان');
    });

    it('1.5 should return 404 for invalid/non-existent exam ID', async () => {
      const res = await request(app)
        .get('/api/v1/exams/00000000-0000-0000-0000-000000000000/instructions')
        .set('Authorization', `Bearer ${studentEnrolledA.token}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // VULN-02: Homework Enrollment Access & BOLA Guard
  // =========================================================================
  describe('VULN-02: Student Homework Access & BOLA Protection', () => {
    it('2.1 should allow enrolled student to get homework questions for taking', async () => {
      const res = await request(app)
        .get(`/api/v1/homework/${homeworkA.id}`)
        .set('Authorization', `Bearer ${studentEnrolledA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(homeworkA.id);
    });

    it('2.2 should reject non-enrolled student from fetching homework questions (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/homework/${homeworkA.id}`)
        .set('Authorization', `Bearer ${studentOtherB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('أنت لست مسجلاً في مجموعة هذا الواجب');
    });

    it('2.3 should reject non-enrolled student from submitting homework answers (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/homework/${homeworkA.id}/submit`)
        .set('Authorization', `Bearer ${studentOtherB.token}`)
        .send({
          answers: [{ questionOrder: 1, selectedOption: 0 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('أنت لست مسجلاً في مجموعة هذا الواجب');
    });
  });

  // =========================================================================
  // VULN-03: Single-Use Refresh Token Rotation (RTR)
  // =========================================================================
  describe('VULN-03: Single-Use Refresh Token Rotation', () => {
    it('3.1 should rotate refresh token and revoke the previous one', async () => {
      // 1. Login to obtain initial tokens
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentEnrolledA.user.email,
          password: studentEnrolledA.rawPassword,
        });

      expect(loginRes.status).toBe(200);
      const token1 = loginRes.body.data.token;
      const refreshToken1 = loginRes.body.data.refreshToken;

      // 2. Refresh tokens using refreshToken1
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refreshToken1 });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.token).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).not.toBe(refreshToken1);

      const token2 = refreshRes.body.data.token;
      const refreshToken2 = refreshRes.body.data.refreshToken;

      // 3. Attempt to REPLAY the old refreshToken1 -> MUST BE REJECTED
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refreshToken1 });

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.success).toBe(false);

      // 4. Using the new refreshToken2 MUST SUCCEED and rotate again
      const nextRefreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refreshToken2 });

      expect(nextRefreshRes.status).toBe(200);
      expect(nextRefreshRes.body.data.refreshToken).not.toBe(refreshToken2);
    });

    it('3.2 should reject refresh with malformed token (401)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'totally.invalid.token' });

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // VULN-05: Account Deletion Password Confirmation Enforcement
  // =========================================================================
  describe('VULN-05: Account Deletion Password Verification', () => {
    let victimUser;

    beforeAll(async () => {
      victimUser = await helper.createStudent({ fullName: 'مستخدم لاختبار الحذف' });
    });

    it('5.1 should reject account deletion when password body is missing (400 Bad Request)', async () => {
      const res = await request(app)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${victimUser.token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('5.2 should reject account deletion with incorrect password (400 Bad Request)', async () => {
      const res = await request(app)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${victimUser.token}`)
        .send({ password: 'WrongPassword123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('كلمة المرور غير صحيحة');
    });

    it('5.3 should allow account deletion with correct password (200 OK)', async () => {
      const res = await request(app)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${victimUser.token}`)
        .send({ password: victimUser.rawPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // VULN-07: File Upload MIME & Extension Spoofing Protection
  // =========================================================================
  describe('VULN-07: File Upload Security & MIME Spoofing Prevention', () => {
    it('7.1 should reject spoofed file upload with .html extension disguised as image/png', async () => {
      const fakeHtmlBuffer = Buffer.from('<script>alert("XSS")</script>', 'utf-8');

      const res = await request(app)
        .put('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentEnrolledA.token}`)
        .attach('avatar', fakeHtmlBuffer, {
          filename: 'exploit.html',
          contentType: 'image/png', // Spoofed MIME
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('7.2 should reject spoofed document upload with .exe extension disguised as application/pdf', async () => {
      const fakeExeBuffer = Buffer.from('MZ binary content', 'utf-8');

      const res = await request(app)
        .post(`/api/v1/teacher/lessons/${homeworkA.lessonId || '11111111-1111-1111-1111-111111111111'}/materials`)
        .set('Authorization', `Bearer ${teacherA.token}`)
        .field('title', 'ملف مشبوه')
        .attach('material', fakeExeBuffer, {
          filename: 'malware.exe',
          contentType: 'application/pdf', // Spoofed MIME
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('7.3 should accept legitimate image upload with matching extension and MIME', async () => {
      // 1x1 transparent PNG binary
      const validPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const res = await request(app)
        .put('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentEnrolledA.token}`)
        .attach('avatar', validPng, {
          filename: 'valid-avatar.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // VULN-04: Stateless Password Reset Token Replay Protection
  // =========================================================================
  describe('VULN-04: Password Reset Token Single-Use & Replay Protection', () => {
    it('4.1 should reject replaying an already-used resetToken a second time (400 Bad Request)', async () => {
      // 1. Request forgot password OTP
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: studentOtherB.user.email });

      const otpRecord = await prisma.oTP.findFirst({
        where: { email: studentOtherB.user.email, type: 'FORGOT_PASSWORD', isUsed: false },
        orderBy: { createdAt: 'desc' },
      });

      // 2. Verify OTP to get resetToken
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          email: studentOtherB.user.email,
          otpCode: otpRecord.otpCode,
        });

      expect(verifyRes.status).toBe(200);
      const resetToken = verifyRes.body.data.resetToken;

      // 3. Reset password first time -> MUST SUCCEED
      const firstResetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: studentOtherB.user.email,
          resetToken,
          newPassword: 'FirstNewPassword123!',
          confirmPassword: 'FirstNewPassword123!',
        });

      expect(firstResetRes.status).toBe(200);
      expect(firstResetRes.body.success).toBe(true);

      // 4. Replay the same resetToken a second time -> MUST BE REJECTED
      const replayResetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: studentOtherB.user.email,
          resetToken,
          newPassword: 'AttackerNewPassword123!',
          confirmPassword: 'AttackerNewPassword123!',
        });

      expect(replayResetRes.status).toBe(400);
      expect(replayResetRes.body.success).toBe(false);
      expect(replayResetRes.body.message).toContain('رمز إعادة التعيين');
    });
  });

  // =========================================================================
  // VULN-09: Anti-Account Enumeration in Forgot Password
  // =========================================================================
  describe('VULN-09: Anti-Account Enumeration', () => {
    it('9.1 should return uniform 200 OK for non-existent email in forgot-password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent_ghost_user_999@eureka.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('nonexistent_ghost_user_999@eureka.com');
    });
  });

  // =========================================================================
  // VULN-10: Capped Pagination Protection (Anti-DoS)
  // =========================================================================
  describe('VULN-10: Capped Pagination PageSize', () => {
    it('10.1 should cap payment ledger pageSize at 100 even if client passes limit=50000', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/finance/payments?limit=50000')
        .set('Authorization', `Bearer ${teacherA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.pageSize).toBe(100);
    });
  });

  // =========================================================================
  // Audit Findings: Input Validation & Boundary Enforcement Tests
  // =========================================================================
  describe('Input Validation & Boundary Enforcement Suite', () => {
    it('AUDIT-1: should reject homework submission with empty body (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/v1/homework/${homeworkA.id}/submit`)
        .set('Authorization', `Bearer ${studentEnrolledA.token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('خطأ في التحقق من صحة البيانات');
      expect(res.body.errors[0].message).toContain('قائمة الإجابات مطلوبة');
    });

    it('AUDIT-2: should reject exam submission with empty body (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${examA.id}/submit`)
        .set('Authorization', `Bearer ${studentEnrolledA.token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('خطأ في التحقق من صحة البيانات');
      expect(res.body.errors[0].message).toContain('قائمة الإجابات مطلوبة');
    });

    it('AUDIT-3: should reject manual attendance batch containing an unenrolled student ID (400 Bad Request)', async () => {
      // Create session in Group A
      const sessionRes = await request(app)
        .post('/api/v1/teacher/attendance/sessions')
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({
          groupId: groupA.id,
          title: 'جلسة تدقيق الحضور',
        });

      expect(sessionRes.status).toBe(201);
      const sessionId = sessionRes.body.data.id;

      // Attempt to submit attendance for studentOtherB (who is NOT enrolled in Group A)
      const res = await request(app)
        .post(`/api/v1/teacher/attendance/sessions/${sessionId}/manual`)
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({
          attendances: [
            {
              studentId: studentOtherB.user.studentProfile.id,
              status: 'PRESENT',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('غير مسجل في هذه المجموعة');
    });

    it('AUDIT-4: should reject FCM token registration with empty/invalid body (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/fcm-token')
        .set('Authorization', `Bearer ${studentEnrolledA.token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
