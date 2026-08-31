import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';
import { signToken } from '../../src/utils/jwt.util.js';

describe('Admin Module Integration Suite', () => {
  const helper = new TestSetupHelper('admin_suite');

  let adminUser;
  let adminToken;
  let teacherUser;
  let studentUser;
  let studentUser2;
  let groupA;
  let groupB;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    // 1. Create Super-Admin Account
    const createdAdmin = await helper.createUser({
      fullName: 'مدير المنصة الرئيسي',
      email: 'admin_test@eureka.com',
      phone: '01099999999',
      role: 'ADMIN',
      isVerified: true,
      isActive: true,
    });
    adminUser = createdAdmin.user;
    adminToken = createdAdmin.token;

    // 2. Create Teacher & Student Accounts
    teacherUser = await helper.createTeacher({ fullName: 'الأستاذ سامح الألفي' });
    studentUser = await helper.createStudent({ fullName: 'الطالب حسام البدري' });
    studentUser2 = await helper.createStudent({ fullName: 'الطالبة منى زكي' });

    // 3. Create Study Groups
    groupA = await helper.createGroup({ teacherId: teacherUser.user.id, name: 'مجموعة الفيزياء 101' });
    groupB = await helper.createGroup({ teacherId: teacherUser.user.id, name: 'مجموعة الفيزياء 102' });

    // 4. Enroll Student 1 in Group A
    await helper.enrollStudent(studentUser.user.studentProfile.id, groupA.id, 'ACTIVE');

    // Ensure SystemSettings exists
    await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: { maintenanceMode: false, registrationOpen: true },
      create: { id: 'default', maintenanceMode: false, registrationOpen: true },
    });
  });

  afterAll(async () => {
    // Reset maintenance mode to false
    await prisma.systemSetting.updateMany({
      where: { id: 'default' },
      data: { maintenanceMode: false },
    });
    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Admin RBAC & Endpoint Access Protection
  // =========================================================================
  describe('1. Admin Access & RBAC Guards', () => {
    it('1.1 should allow authenticated Admin to access /admin/dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platformStats).toBeDefined();
      expect(res.body.data.platformStats.totalActiveStudents).toBeGreaterThanOrEqual(1);
    });

    it('1.2 should reject Student from accessing /admin/dashboard with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${studentUser.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('1.3 should reject Teacher from accessing /admin/dashboard with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${teacherUser.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('1.4 should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. User Lifecycle & Moderation
  // =========================================================================
  describe('2. User Lifecycle Management', () => {
    it('2.1 should retrieve paginated users list with search and role filter', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=STUDENT&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.pagination.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('2.2 should suspend student account and verify user cannot access protected routes or login', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${studentUser.user.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isActive: false,
          reason: 'مخالفة شروط الاستخدام وسياسة المنصة',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);

      // Verify suspended student cannot call protected APIs (403 Forbidden)
      const protectedRes = await request(app)
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentUser.token}`);

      expect(protectedRes.status).toBe(403);
      expect(protectedRes.body.message).toContain('تم إيقاف هذا الحساب');

      // Verify suspended student cannot login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentUser.user.email,
          password: 'Password123!',
        });

      expect(loginRes.status).toBe(403);
    });

    it('2.3 should reactivate student account and allow login again', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${studentUser.user.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isActive: true,
          reason: 'تم رفع الحظر بعد المراجعة',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);

      // Verify student can now login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentUser.user.email,
          password: 'Password123!',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      studentUser.token = loginRes.body.data.token;
    });

    it('2.4 should prevent removing role of last active Admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'STUDENT',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('2.5 should force logout user and reset password', async () => {
      const forceLogoutRes = await request(app)
        .post(`/api/v1/admin/users/${studentUser.user.id}/force-logout`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(forceLogoutRes.status).toBe(200);

      const resetPassRes = await request(app)
        .post(`/api/v1/admin/users/${studentUser.user.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newPassword: 'NewSecurePassword2026!',
        });

      expect(resetPassRes.status).toBe(200);

      // Login with new password
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentUser.user.email,
          password: 'NewSecurePassword2026!',
        });

      expect(newLoginRes.status).toBe(200);
      studentUser.token = newLoginRes.body.data.token;
    });

    it('2.6 should export users list to valid CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('ID,Full Name,Email,Phone,Role');
    });
  });

  // =========================================================================
  // 3. Teacher Management & Approval Queue
  // =========================================================================
  describe('3. Teacher Approvals & Workload', () => {
    let unverifiedTeacher;

    beforeAll(async () => {
      unverifiedTeacher = await helper.createUser({
        fullName: 'معلم تحت الاختبار',
        email: 'unverified_teacher@eureka.com',
        phone: '01088776655',
        role: 'TEACHER',
        isVerified: false,
        isActive: true,
      });
    });

    it('3.1 should list pending teachers queue', async () => {
      const res = await request(app)
        .get('/api/v1/admin/teachers/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const target = res.body.data.teachers.find((t) => t.id === unverifiedTeacher.user.id);
      expect(target).toBeDefined();
    });

    it('3.2 should approve teacher and set isVerified to true', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/teachers/${unverifiedTeacher.user.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isVerified).toBe(true);
    });

    it('3.3 should inspect teacher 360° workload and stats', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/teachers/${teacherUser.user.id}/stats`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workload).toBeDefined();
      expect(res.body.data.workload.totalGroups).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 4. Student 360° History & Group Transfers
  // =========================================================================
  describe('4. Student Academic History & Group Transfer', () => {
    it('4.1 should retrieve student 360° academic lifetime history', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/students/${studentUser.user.studentProfile.id}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student.fullName).toBe(studentUser.user.fullName);
      expect(res.body.data.enrolledGroups.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summaryMetrics).toBeDefined();
    });

    it('4.2 should transactionally transfer student from Group A to Group B', async () => {
      const res = await request(app)
        .post('/api/v1/admin/enrollments/transfer')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentProfileId: studentUser.user.studentProfile.id,
          fromGroupId: groupA.id,
          toGroupId: groupB.id,
          reason: 'طلب ولي الأمر تغيير الموعد',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toGroup.id).toBe(groupB.id);

      // Verify old enrollment is TRANSFERRED and new enrollment is ACTIVE
      const oldEnrollment = await prisma.groupEnrollment.findFirst({
        where: { studentId: studentUser.user.studentProfile.id, groupId: groupA.id },
      });
      expect(oldEnrollment.status).toBe('TRANSFERRED');

      const newEnrollment = await prisma.groupEnrollment.findFirst({
        where: { studentId: studentUser.user.studentProfile.id, groupId: groupB.id },
      });
      expect(newEnrollment.status).toBe('ACTIVE');
    });

    it('4.3 should manually enroll Student 2 in Group A using admin direct override', async () => {
      const res = await request(app)
        .post('/api/v1/admin/enrollments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentProfileId: studentUser2.user.studentProfile.id,
          groupId: groupA.id,
          enrollmentPrice: 400,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enrollment.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // 5. Attendance Administration & At-Risk Tracking
  // =========================================================================
  describe('5. Attendance Analytics & At-Risk Alerts', () => {
    it('5.1 should get system-wide attendance overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.systemAttendancePercentage).toBeDefined();
    });

    it('5.2 should export attendance records to CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/attendance/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // =========================================================================
  // 6. Finance Administration
  // =========================================================================
  describe('6. Financial Ledger & Revenue KPIs', () => {
    it('6.1 should get platform financial summary KPIs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/finance/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRevenueCollected).toBeDefined();
      expect(Array.isArray(res.body.data.paymentMethodsBreakdown)).toBe(true);
    });

    it('6.2 should get payments list and unpaid students roster', async () => {
      const [paymentsRes, unpaidRes] = await Promise.all([
        request(app).get('/api/v1/admin/finance/payments').set('Authorization', `Bearer ${adminToken}`),
        request(app).get('/api/v1/admin/finance/unpaid').set('Authorization', `Bearer ${adminToken}`),
      ]);

      expect(paymentsRes.status).toBe(200);
      expect(unpaidRes.status).toBe(200);
      expect(Array.isArray(unpaidRes.body.data.unpaidRoster)).toBe(true);
    });
  });

  // =========================================================================
  // 7. Academic Catalogue CRUD
  // =========================================================================
  describe('7. Academic Catalogue Management', () => {
    let createdSubjectId;

    it('7.1 should create a new subject', async () => {
      const res = await request(app)
        .post('/api/v1/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('nameAr', 'علم الأحياء المتقدم')
        .field('nameEn', 'Advanced Biology');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdSubjectId = res.body.data.id;
    });

    it('7.2 should archive subject (soft-delete without destroying records)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/subjects/${createdSubjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 8. Global Platform Broadcasts
  // =========================================================================
  describe('8. Platform Broadcasts', () => {
    it('8.1 should dispatch global platform announcement to all students', async () => {
      const res = await request(app)
        .post('/api/v1/admin/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetAudience: 'STUDENTS',
          title: '📢 إعلان عام لجميع الطلاب',
          message: 'نود إعلامكم ببدء التسجيل للفصل الدراسي الجديد',
          type: 'ANNOUNCEMENT',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipientCount).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 9. Platform Maintenance Settings
  // =========================================================================
  describe('9. Platform Settings & Maintenance Mode Guard', () => {
    it('9.1 should toggle maintenance mode to true and block non-admin requests with 503', async () => {
      // Admin turns on maintenance mode
      const setRes = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maintenanceMode: true,
        });

      expect(setRes.status).toBe(200);
      expect(setRes.body.data.maintenanceMode).toBe(true);

      // Student tries to access student routes -> receives 503 Service Unavailable
      const studentRes = await request(app)
        .get('/api/v1/academic/stages')
        .set('Authorization', `Bearer ${studentUser.token}`);

      expect(studentRes.status).toBe(503);
      expect(studentRes.body.code).toBe('MAINTENANCE_MODE');

      // Admin route remains accessible
      const adminRes = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);

      // Health endpoint remains accessible
      const healthRes = await request(app).get('/health');
      expect(healthRes.status).toBe(200);
    });

    it('9.2 should toggle maintenance mode back to false and restore normal traffic', async () => {
      const resetRes = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maintenanceMode: false,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.maintenanceMode).toBe(false);
    });
  });

  // =========================================================================
  // 10. Audit Logs
  // =========================================================================
  describe('10. Audit Logging', () => {
    it('10.1 should retrieve administrative audit trail logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.logs)).toBe(true);
      expect(res.body.data.logs.length).toBeGreaterThanOrEqual(1);

      const actionTypes = res.body.data.logs.map((l) => l.action);
      expect(actionTypes).toContain('USER_SUSPENDED');
      expect(actionTypes).toContain('STUDENT_TRANSFERRED');
    });
  });
});
