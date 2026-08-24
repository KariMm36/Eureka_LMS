import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Groups Module Integration Tests', () => {
  const helper = new TestSetupHelper('groups_suite');

  let studentA;
  let studentB;
  let teacherUser;
  let testGroup;
  let fullGroup;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    studentA = await helper.createUser({ role: 'STUDENT', fullName: 'طالب أ مجموعات' });
    studentB = await helper.createUser({ role: 'STUDENT', fullName: 'طالب ب مجموعات' });
    teacherUser = await helper.createUser({ role: 'TEACHER', fullName: 'معلم فيزياء تجريبي' });

    testGroup = await helper.createGroup({
      teacherId: teacherUser.user.id,
      maxCapacity: 10,
    });

    fullGroup = await helper.createGroup({
      teacherId: teacherUser.user.id,
      maxCapacity: 1,
    });
    // Fill the full group to capacity
    await helper.enrollStudent(studentB.user.studentProfile.id, fullGroup.id);
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  describe('1. Search Groups (GET /api/v1/groups/search)', () => {
    it('should return paginated list of active groups with normalized scheduleDays', async () => {
      const res = await request(app)
        .get('/api/v1/groups/search')
        .set('Authorization', `Bearer ${studentA.token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.groups).toBeDefined();
      expect(Array.isArray(res.body.data.groups)).toBe(true);
      expect(res.body.data.groups.length).toBeGreaterThan(0);

      const foundGroup = res.body.data.groups.find((g) => g.id === testGroup.id);
      expect(foundGroup).toBeDefined();
      expect(Array.isArray(foundGroup.scheduleDays)).toBe(true); // Verifies normalization
    });

    it('should filter groups by subjectId', async () => {
      const res = await request(app)
        .get('/api/v1/groups/search')
        .set('Authorization', `Bearer ${studentA.token}`)
        .query({ subjectId: helper.createdAcademicIds.subjectId });

      expect(res.status).toBe(200);
      expect(res.body.data.groups.every((g) => g.subject.id === helper.createdAcademicIds.subjectId)).toBe(true);
    });
  });

  describe('2. Preview Group by Code (GET /api/v1/groups/preview/:code)', () => {
    it('should return preview details for a valid group code', async () => {
      const res = await request(app)
        .get(`/api/v1/groups/preview/${testGroup.groupCode}`)
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testGroup.id);
      expect(res.body.data.groupCode).toBe(testGroup.groupCode);
      expect(res.body.data.teacher.fullName).toBe(teacherUser.user.fullName);
    });

    it('should return 404 for invalid group code', async () => {
      const res = await request(app)
        .get('/api/v1/groups/preview/NON_EXISTENT_CODE_999')
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Join Group by Code (POST /api/v1/groups/join-by-code)', () => {
    it('should successfully enroll student in group using valid code', async () => {
      const res = await request(app)
        .post('/api/v1/groups/join-by-code')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ groupCode: testGroup.groupCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enrollment).toBeDefined();
      expect(res.body.data.enrollment.status).toBe('ACTIVE');

      // Verify in DB
      const enrollment = await prisma.groupEnrollment.findUnique({
        where: {
          groupId_studentId: {
            groupId: testGroup.id,
            studentId: studentA.user.studentProfile.id,
          },
        },
      });
      expect(enrollment).not.toBeNull();
      expect(enrollment.status).toBe('ACTIVE');
    });

    it('should reject enrollment if student is already active in the group (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/groups/join-by-code')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ groupCode: testGroup.groupCode });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('أنت منضم بالفعل');
    });

    it('should reject enrollment if group is full (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/groups/join-by-code')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ groupCode: fullGroup.groupCode });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('ممتلئة بالكامل');
    });

    it('should reject non-student roles from joining (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/groups/join-by-code')
        .set('Authorization', `Bearer ${teacherUser.token}`)
        .send({ groupCode: testGroup.groupCode });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Re-join Inactive Group (Smart Re-activation)', () => {
    it('should reactivate student enrollment when rejoining a group they previously left', async () => {
      // Simulate student leaving group (setting status to INACTIVE)
      await prisma.groupEnrollment.update({
        where: {
          groupId_studentId: {
            groupId: testGroup.id,
            studentId: studentA.user.studentProfile.id,
          },
        },
        data: { status: 'INACTIVE' },
      });

      const res = await request(app)
        .post('/api/v1/groups/join-by-code')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ groupCode: testGroup.groupCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('تم إعادة الانضمام بنجاح');
      expect(res.body.data.enrollment.status).toBe('ACTIVE');
    });
  });

  describe('5. My Enrolled Groups (GET /api/v1/groups/my-groups)', () => {
    it('should return list of groups the student is actively enrolled in', async () => {
      const res = await request(app)
        .get('/api/v1/groups/my-groups')
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((item) => item.group.id === testGroup.id)).toBe(true);
    });
  });
});
