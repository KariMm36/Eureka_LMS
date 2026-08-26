import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Teacher Attendance & QR Roll-Call Integration Suite', () => {
  let helper;
  let teacherA;
  let teacherB;
  let enrolledStudent;
  let outsiderStudent;
  let group;
  let createdSessionId;
  let liveQrToken;
  let liveSessionCode;

  beforeAll(async () => {
    helper = new TestSetupHelper('teacher_att');
    await helper.createAcademicHierarchy();

    // 1. Create Teachers
    teacherA = await helper.createTeacher({ fullName: 'الأستاذ أحمد فوزي' });
    teacherB = await helper.createTeacher({ fullName: 'الأستاذ محمود إبراهيم' });

    // 2. Create Students
    enrolledStudent = await helper.createStudent({ fullName: 'الطالب المقيد' });
    outsiderStudent = await helper.createStudent({ fullName: 'طالب خارجي' });

    // 3. Create Group and enroll student
    group = await helper.createGroup({ teacherId: teacherA.user.id });
    await helper.enrollStudent(enrolledStudent.user.studentProfile.id, group.id);
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  it('1. should create a class attendance session', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        groupId: group.id,
        title: 'حصة الفيزياء - الحركة التوافقية البسيطة',
        sessionDate: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.totalEnrolled).toBe(1);

    createdSessionId = res.body.data.id;
  });

  it('2. should generate live QR token and 6-digit PIN code with 10-min TTL', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/attendance/sessions/${createdSessionId}/qr`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.qrToken).toBeDefined();
    expect(res.body.data.sessionCode).toBeDefined();
    expect(res.body.data.qrDataUrl).toContain('data:image/png;base64');
    expect(res.body.data.expiresInSeconds).toBe(600);

    liveQrToken = res.body.data.qrToken;
    liveSessionCode = res.body.data.sessionCode;
  });

  it('3. should allow enrolled student to record attendance using QR token', async () => {
    const res = await request(app)
      .post('/api/v1/students/attendance/record')
      .set('Authorization', `Bearer ${enrolledStudent.token}`)
      .send({
        qrToken: liveQrToken,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attendance.status).toBe('PRESENT');
  });

  it('4. should allow enrolled student to record attendance using 6-digit session PIN code', async () => {
    const res = await request(app)
      .post('/api/v1/students/attendance/record')
      .set('Authorization', `Bearer ${enrolledStudent.token}`)
      .send({
        sessionCode: liveSessionCode,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attendance.status).toBe('PRESENT');
  });

  it('5. should reject non-enrolled student from recording attendance (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/v1/students/attendance/record')
      .set('Authorization', `Bearer ${outsiderStudent.token}`)
      .send({
        qrToken: liveQrToken,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('مسجلاً');
  });

  it('6. should reject invalid or expired attendance code (404 Not Found)', async () => {
    const res = await request(app)
      .post('/api/v1/students/attendance/record')
      .set('Authorization', `Bearer ${enrolledStudent.token}`)
      .send({
        sessionCode: '000000',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('7. should perform batch manual roll-call (PRESENT / LATE / ABSENT)', async () => {
    const res = await request(app)
      .post(`/api/v1/teacher/attendance/sessions/${createdSessionId}/manual`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        attendances: [
          {
            studentId: enrolledStudent.user.studentProfile.id,
            status: 'LATE',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updatedCount).toBe(1);
  });

  it('8. should get session attendance details report', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/attendance/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats.totalEnrolled).toBe(1);
    expect(res.body.data.stats.lateCount).toBe(1);
    expect(res.body.data.students.length).toBe(1);
  });

  it('9. should get attendance dashboard overview and calendar', async () => {
    // 1. Overview
    const overviewRes = await request(app)
      .get('/api/v1/teacher/attendance/overview')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.kpis).toBeDefined();

    // 2. Calendar
    const calendarRes = await request(app)
      .get('/api/v1/teacher/attendance/calendar')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(calendarRes.status).toBe(200);
    expect(Array.isArray(calendarRes.body.data.calendar)).toBe(true);
  });

  it('10. [IDOR Prevention] Teacher B cannot access or modify Teacher A session', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/attendance/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${teacherB.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
