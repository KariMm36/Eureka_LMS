import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Teacher Groups & Student Roster Integration Suite', () => {
  let helper;
  let teacherA;
  let teacherB;
  let hierarchy;
  let createdGroupId;
  let enrolledStudentId;

  beforeAll(async () => {
    helper = new TestSetupHelper('teacher_grp');
    hierarchy = await helper.createAcademicHierarchy();

    // Create Teacher A and Teacher B for IDOR testing
    teacherA = await helper.createTeacher({ fullName: 'الأستاذ أحمد فوزي' });
    teacherB = await helper.createTeacher({ fullName: 'الأستاذ محمود إبراهيم' });
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  it('1. should create a new study group with schedule and default price', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/groups')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        name: 'مجموعة الفيزياء الذرية',
        subjectId: hierarchy.subject.id,
        stageId: hierarchy.stage.id,
        gradeLevelId: hierarchy.gradeLevel.id,
        scheduleDays: 'الأحد,الثلاثاء',
        scheduleTime: '06:00 PM',
        maxCapacity: 40,
        defaultPrice: 350,
        description: 'شرح وتدريبات أسبوعية',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.groupCode).toBeDefined();
    expect(res.body.data.defaultPrice).toBe(350);

    createdGroupId = res.body.data.id;
    helper.createdGroupIds.add(createdGroupId);
  });

  it('2. should list teacher groups with active counts', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/groups')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.groups.length).toBeGreaterThanOrEqual(1);

    const group = res.body.data.groups.find((g) => g.id === createdGroupId);
    expect(group).toBeDefined();
    expect(group.name).toBe('مجموعة الفيزياء الذرية');
  });

  it('3. should get group details by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdGroupId);
    expect(res.body.data.stats).toBeDefined();
  });

  it('4. should update group schedule, capacity, and default price', async () => {
    const res = await request(app)
      .put(`/api/v1/teacher/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        name: 'مجموعة الفيزياء الذرية المتقدمة',
        maxCapacity: 45,
        defaultPrice: 400,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('مجموعة الفيزياء الذرية المتقدمة');
    expect(res.body.data.defaultPrice).toBe(400);
  });

  it('5. [IDOR Prevention] Teacher B cannot access or edit Teacher A group', async () => {
    // Attempt GET
    const getRes = await request(app)
      .get(`/api/v1/teacher/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${teacherB.token}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.success).toBe(false);

    // Attempt PUT
    const putRes = await request(app)
      .put(`/api/v1/teacher/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${teacherB.token}`)
      .send({ name: 'محاولة اختراق' });

    expect(putRes.status).toBe(404);
    expect(putRes.body.success).toBe(false);
  });

  it('6. should generate group QR invite code payload', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/groups/${createdGroupId}/qr-code`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.qrPayload).toContain('EUREKA_GROUP:');
    expect(res.body.data.qrDataUrl).toContain('data:image/png;base64');
  });

  it('7. should add a brand new student (create account + temp password)', async () => {
    const newStudentPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await request(app)
      .post(`/api/v1/teacher/groups/${createdGroupId}/students`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        fullName: 'طالب جديد أنشأه المعلم',
        phone: newStudentPhone,
        email: `newstudent.${newStudentPhone}@eureka-test.com`,
        parentPhone: '01099887766',
        enrollmentPrice: 300,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.isNewAccount).toBe(true);
    expect(res.body.data.student.temporaryPassword).toBeDefined();

    enrolledStudentId = res.body.data.student.id;
  });

  it('8. should enroll an existing student account without creating duplicate account', async () => {
    const existingStudent = await helper.createStudent({ fullName: 'طالب مسجل مسبقاً' });

    const res = await request(app)
      .post(`/api/v1/teacher/groups/${createdGroupId}/students`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        fullName: existingStudent.user.fullName,
        phone: existingStudent.user.phone,
        email: existingStudent.user.email,
        enrollmentPrice: 350,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.isNewAccount).toBe(false);
  });

  it('9. should reject duplicate active student enrollment with 409 Conflict', async () => {
    const res = await request(app)
      .post(`/api/v1/teacher/groups/${createdGroupId}/students`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        fullName: 'طالب مكرر',
        phone: (await request(app).get(`/api/v1/teacher/students/${enrolledStudentId}`).set('Authorization', `Bearer ${teacherA.token}`)).body.data.studentInfo.phone,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('10. should get group student roster with payment status', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/groups/${createdGroupId}/students`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.students.length).toBe(2);

    const firstStudent = res.body.data.students[0];
    expect(firstStudent.paymentStatus).toBeDefined();
    expect(firstStudent.attendanceRatePercentage).toBeDefined();
  });

  it('11. should get detailed student modal with attendance stats and ledger', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/students/${enrolledStudentId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentInfo.id).toBe(enrolledStudentId);
    expect(res.body.data.attendanceStats).toBeDefined();
    expect(res.body.data.financialLedger).toBeDefined();
  });

  it('12. should update student custom enrollment price in group', async () => {
    const res = await request(app)
      .put(`/api/v1/teacher/students/${enrolledStudentId}`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        enrollmentPrice: 250, // Discount for sibling
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enrollment.enrollmentPrice).toBe(250);
  });

  it('13. should get teacher profile and update app preferences', async () => {
    // 1. Get Profile
    const profileRes = await request(app)
      .get('/api/v1/teacher/profile')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.fullName).toBe('الأستاذ أحمد فوزي');

    // 2. Update Settings
    const settingsRes = await request(app)
      .put('/api/v1/teacher/settings')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        appLanguage: 'ar',
        darkMode: true,
        notifyExams: true,
      });

    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.data.darkMode).toBe(true);
  });

  it('14. should soft-delete / deactivate group', async () => {
    const res = await request(app)
      .delete(`/api/v1/teacher/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
