import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Adversarial & Edge-Case Audit Suite — Admin & Platform Security', () => {
  const helper = new TestSetupHelper('adversarial_suite');

  let adminUser1;
  let adminToken1;
  let adminUser2;
  let adminToken2;
  let teacherUser;
  let studentUser;
  let fullGroup;
  let regularGroup;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    // 1. Create 2 Admin accounts to test last-admin logic and self-demotion
    const createdAdmin1 = await helper.createUser({
      fullName: 'مدير المنصة الأول',
      email: 'admin_audit1@eureka.com',
      phone: '01099990001',
      role: 'ADMIN',
      isVerified: true,
      isActive: true,
    });
    adminUser1 = createdAdmin1.user;
    adminToken1 = createdAdmin1.token;

    const createdAdmin2 = await helper.createUser({
      fullName: 'مدير المنصة الثاني',
      email: 'admin_audit2@eureka.com',
      phone: '01099990002',
      role: 'ADMIN',
      isVerified: true,
      isActive: true,
    });
    adminUser2 = createdAdmin2.user;
    adminToken2 = createdAdmin2.token;

    teacherUser = await helper.createTeacher({ fullName: 'الأستاذ عماد حمدي' });
    studentUser = await helper.createStudent({ fullName: 'الطالب كريم عبد العزيز' });

    // Create a group with maxCapacity = 1 to test capacity overflow
    fullGroup = await helper.createGroup({
      teacherId: teacherUser.user.id,
      name: 'مجموعة ممتلئة بالكامل',
      maxCapacity: 1,
    });
    regularGroup = await helper.createGroup({
      teacherId: teacherUser.user.id,
      name: 'مجموعة عادية',
      maxCapacity: 10,
    });

    // Fill the fullGroup to capacity
    await helper.enrollStudent(studentUser.user.studentProfile.id, fullGroup.id, 'ACTIVE');

    // Ensure SystemSettings initialized
    await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: { maintenanceMode: false, registrationOpen: true },
      create: { id: 'default', maintenanceMode: false, registrationOpen: true },
    });
  });

  afterAll(async () => {
    await prisma.systemSetting.updateMany({
      where: { id: 'default' },
      data: { maintenanceMode: false, registrationOpen: true },
    });
    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Last Admin Protection & Privilege Escalation Adversarial Tests
  // =========================================================================
  describe('1. Privilege Escalation & Last Admin Protection', () => {
    it('1.1 should prevent an Admin from demoting or deactivating themselves (self-lockout prevention)', async () => {
      const roleRes = await request(app)
        .patch(`/api/v1/admin/users/${adminUser1.id}/role`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({ role: 'TEACHER' });

      expect(roleRes.status).toBe(400);
      expect(roleRes.body.success).toBe(false);
      expect(roleRes.body.message).toContain('لا يمكنك إزالة دور المشرف');

      const statusRes = await request(app)
        .patch(`/api/v1/admin/users/${adminUser1.id}/status`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({ isActive: false });

      expect(statusRes.status).toBe(400);
      expect(statusRes.body.message).toContain('لا يمكنك تعطيل حساب المشرف الخاص بك');
    });

    it('1.2 should allow Admin 1 to demote Admin 2 when multiple active Admins exist', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser2.id}/role`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({ role: 'TEACHER', reason: 'نقل إلى طاقم التدريس' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('TEACHER');

      // Verify Admin 2 session was revoked
      const meRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken2}`);

      // Now that Admin 2 is TEACHER, accessing admin dashboard must return 403 Forbidden
      expect(meRes.status).toBe(403);
    });

    it('1.3 should reject invalid role strings with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${teacherUser.user.id}/role`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({ role: 'SUPER_ROOT_HACKER' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Group Capacity Constraints & Transfer Safety
  // =========================================================================
  describe('2. Group Capacity Limits & Transfer Safety', () => {
    let secondStudent;

    beforeAll(async () => {
      secondStudent = await helper.createStudent({ fullName: 'الطالب حسام البدري 2' });
    });

    it('2.1 should reject manual enrollment when destination group is at max capacity', async () => {
      // fullGroup capacity is 1, and studentUser is already in it
      const res = await request(app)
        .post('/api/v1/admin/enrollments')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          studentProfileId: secondStudent.user.studentProfile.id,
          groupId: fullGroup.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('ممتلئة بالكامل');
    });

    it('2.2 should reject transfer when destination group is at max capacity', async () => {
      // Enroll secondStudent in regularGroup first
      await helper.enrollStudent(secondStudent.user.studentProfile.id, regularGroup.id, 'ACTIVE');

      // Attempt transfer to fullGroup
      const res = await request(app)
        .post('/api/v1/admin/enrollments/transfer')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          studentProfileId: secondStudent.user.studentProfile.id,
          fromGroupId: regularGroup.id,
          toGroupId: fullGroup.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('ممتلئة بالكامل');
    });

    it('2.3 should reject transfer if student is not active in source group', async () => {
      const thirdStudent = await helper.createStudent({ fullName: 'طالب غير منضم' });

      const res = await request(app)
        .post('/api/v1/admin/enrollments/transfer')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          studentProfileId: thirdStudent.user.studentProfile.id,
          fromGroupId: regularGroup.id,
          toGroupId: regularGroup.id,
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. Registration Control Guard
  // =========================================================================
  describe('3. Platform Registration Toggle Enforcement', () => {
    it('3.1 should block public registration when registrationOpen is set to false', async () => {
      // Admin turns off registration
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({ registrationOpen: false });

      // Attempt student registration
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'طالب محظور من التسجيل',
          email: `blocked_reg_${Date.now()}@eureka.com`,
          phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'Password123!',
          confirmPassword: 'Password123!',
          role: 'STUDENT',
        });

      expect(regRes.status).toBe(403);
      expect(regRes.body.success).toBe(false);
      expect(regRes.body.message).toContain('التسجيل في المنصة مغلق');
    });

    it('3.2 should allow public registration again when registrationOpen is set back to true', async () => {
      // Admin turns registration back on
      await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({ registrationOpen: true });

      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'طالب مسموح بالتسجيل',
          email: `allowed_reg_${Date.now()}@eureka.com`,
          phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'Password123!',
          confirmPassword: 'Password123!',
          role: 'STUDENT',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 4. Audit Log Integrity & Secret Redaction
  // =========================================================================
  describe('4. Audit Log Integrity & Secret Redaction', () => {
    it('4.1 should never store raw passwords or tokens inside AuditLog metadata', async () => {
      // Reset user password via admin API
      await request(app)
        .post(`/api/v1/admin/users/${studentUser.user.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          newPassword: 'SecretRawPassword123!',
          reason: 'تدقيق أمني',
        });

      const auditRes = await request(app)
        .get('/api/v1/admin/audit-logs?action=USER_PASSWORD_RESET')
        .set('Authorization', `Bearer ${adminToken1}`);

      expect(auditRes.status).toBe(200);
      const logs = auditRes.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const latestLog = logs[0];
      const rawMetadata = JSON.stringify(latestLog.metadata);

      // Verify no password leaks
      expect(rawMetadata).not.toContain('SecretRawPassword123!');
      expect(rawMetadata).not.toContain('passwordHash');
    });
  });

  // =========================================================================
  // 5. CSV UTF-8 Byte Order Mark (BOM) for Excel
  // =========================================================================
  describe('5. CSV UTF-8 BOM Verification', () => {
    it('5.1 should start CSV exports with UTF-8 BOM character \\uFEFF', async () => {
      const [usersRes, attendanceRes, financeRes] = await Promise.all([
        request(app).get('/api/v1/admin/users/export').set('Authorization', `Bearer ${adminToken1}`),
        request(app).get('/api/v1/admin/attendance/export').set('Authorization', `Bearer ${adminToken1}`),
        request(app).get('/api/v1/admin/finance/export').set('Authorization', `Bearer ${adminToken1}`),
      ]);

      expect(usersRes.text.startsWith('\uFEFF')).toBe(true);
      expect(attendanceRes.text.startsWith('\uFEFF')).toBe(true);
      expect(financeRes.text.startsWith('\uFEFF')).toBe(true);
    });
  });
});
