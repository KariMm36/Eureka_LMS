import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { AcademicService } from '../../src/modules/academic/academic.service.js';
import { GroupService } from '../../src/modules/groups/group.service.js';
import { HomeService } from '../../src/modules/home/home.service.js';
import { TeacherService } from '../../src/modules/teacher/teacher.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Zero-Redis Direct Database & Standalone Server Architecture Suite', () => {
  const helper = new TestSetupHelper('zero_redis_suite');
  let studentUser;
  let teacherUser;
  let stage;
  let grade;
  let subject;
  let group;

  beforeAll(async () => {
    await helper.cleanup();

    // 1. Create academic hierarchy
    const academic = await helper.createAcademicHierarchy();
    stage = academic.stage;
    grade = academic.grade;
    subject = academic.subject;

    // 2. Create users & group
    teacherUser = await helper.createUser({ role: 'TEACHER' });
    studentUser = await helper.createUser({ role: 'STUDENT' });
    group = await helper.createGroup({ teacherId: teacherUser.user.id });

    // Enroll student in group
    await helper.enrollStudent(studentUser.user.studentProfile.id, group.id, 'ACTIVE');
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Academic Hierarchy Direct-DB Queries
  // =========================================================================
  describe('1. Academic Hierarchy Direct-DB Queries', () => {
    it('1.1 should fetch all stages directly from database without Redis', async () => {
      const stages = await AcademicService.getAllStages();
      expect(Array.isArray(stages)).toBe(true);
      expect(stages.length).toBeGreaterThan(0);
      expect(stages[0]).toHaveProperty('nameAr');
      expect(stages[0]).toHaveProperty('grades');
    });

    it('1.2 should fetch all global subjects directly from database', async () => {
      const subjects = await AcademicService.getSubjects();
      expect(Array.isArray(subjects)).toBe(true);
      expect(subjects.length).toBeGreaterThan(0);
      expect(subjects[0]).toHaveProperty('nameAr');
    });
  });

  // =========================================================================
  // 2. Group Preview Direct-DB Query
  // =========================================================================
  describe('2. Group Preview Direct-DB Query', () => {
    it('2.1 should preview group details by code directly from database', async () => {
      const preview = await GroupService.previewGroupByCode(group.groupCode);
      expect(preview).toBeDefined();
      expect(preview.id).toBe(group.id);
      expect(preview.groupCode).toBe(group.groupCode);
      expect(preview.teacher.id).toBe(teacherUser.user.id);
      expect(preview.studentCount).toBe(1);
    });

    it('2.2 should throw 404 for non-existent group code', async () => {
      await expect(GroupService.previewGroupByCode('NON-EXIST-999')).rejects.toThrow();
    });
  });

  // =========================================================================
  // 3. Student Home Dashboard Aggregation
  // =========================================================================
  describe('3. Student Home Dashboard Aggregation', () => {
    it('3.1 should assemble consolidated home dashboard directly from database', async () => {
      const dashboard = await HomeService.getHomeDashboard(studentUser.user.id);
      expect(dashboard).toBeDefined();
      expect(dashboard.studentInfo).toBeDefined();
      expect(dashboard.studentInfo.id).toBe(studentUser.user.id);
      expect(dashboard.todaySchedule).toBeDefined();
      expect(dashboard.pendingHomework).toBeDefined();
      expect(dashboard.announcements).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Teacher Dashboard KPIs Aggregation
  // =========================================================================
  describe('4. Teacher Dashboard KPIs Aggregation', () => {
    it('4.1 should calculate KPIs and active rosters directly from database', async () => {
      const dashboard = await TeacherService.getDashboard(teacherUser.user.id);
      expect(dashboard).toBeDefined();
      expect(dashboard.kpis).toBeDefined();
      expect(dashboard.kpis.totalStudents).toBe(1);
      expect(dashboard.kpis.activeGroupsCount).toBe(1);
      expect(dashboard.todaySchedule).toBeDefined();
      expect(dashboard.activeExams).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Authentication & Session Handling Without Redis
  // =========================================================================
  describe('5. Authentication & Session Handling Without Redis', () => {
    it('5.1 should authenticate user session directly via database lookup', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${studentUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(studentUser.user.id);
      expect(res.body.data.email).toBe(studentUser.user.email);
    });

    it('5.2 should successfully logout without Redis session deletion dependencies', async () => {
      const tempUser = await helper.createUser({ role: 'STUDENT' });
      const logoutResult = await AuthService.logout(tempUser.user.id);
      expect(logoutResult.message).toBe('تم تسجيل الخروج بنجاح');

      const userInDb = await prisma.user.findUnique({ where: { id: tempUser.user.id } });
      expect(userInDb.refreshTokenHash).toBeNull();
    });
  });
});
