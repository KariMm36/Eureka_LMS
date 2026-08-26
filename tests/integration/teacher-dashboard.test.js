import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Teacher Dashboard & Metrics Integration Suite', () => {
  let helper;
  let teacherUser;
  let teacherToken;
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    helper = new TestSetupHelper('teacher_dash');
    await helper.createAcademicHierarchy();

    // 1. Create Teacher and Student
    const teacher = await helper.createTeacher();
    teacherUser = teacher.user;
    teacherToken = teacher.token;

    const student = await helper.createStudent();
    studentUser = student.user;
    studentToken = student.token;

    // 2. Create Group with Student for this teacher
    const group = await helper.createGroup({
      teacherId: teacherUser.id,
    });
    await helper.enrollStudent(studentUser.studentProfile.id, group.id);
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  it('should return 200 and consolidated dashboard KPIs for teacher', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/dashboard')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.kpis).toBeDefined();
    expect(typeof data.kpis.totalStudents).toBe('number');
    expect(typeof data.kpis.activeGroupsCount).toBe('number');
    expect(data.kpis.activeGroupsCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.todaySchedule)).toBe(true);
    expect(Array.isArray(data.activeExams)).toBe(true);
    expect(Array.isArray(data.recentGroups)).toBe(true);
  });

  it('should reject student accessing teacher dashboard with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('الصلاحية');
  });

  it('should reject unauthenticated request with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/teacher/dashboard');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
