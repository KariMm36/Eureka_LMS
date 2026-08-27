import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Group Capacity Concurrency & Atomicity Suite', () => {
  const helper = new TestSetupHelper('concurr_suite');
  let teacher;
  let testGroup;
  let candidateStudents = [];
  let unenrolledStudent;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    teacher = await helper.createUser({ role: 'TEACHER', fullName: 'أستاذ الاختبار التزامني' });

    // Create group with strict capacity of 1 seat
    testGroup = await helper.createGroup({
      teacherId: teacher.user.id,
      name: 'مجموعة النخبة التزامنية (مقعد واحد فقط)',
      maxCapacity: 1, // STRICTLY 1 SEAT
    });

    // Create 10 distinct student users for concurrent race
    for (let i = 0; i < 10; i++) {
      const student = await helper.createUser({ role: 'STUDENT', fullName: `طالب تنافسي ${i + 1}` });
      candidateStudents.push(student);
    }

    // Create 1 separate unenrolled student for full group test
    unenrolledStudent = await helper.createUser({ role: 'STUDENT', fullName: 'طالب غير منضم إطلاقاً' });
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  it('1. should allow exactly ONE student to enroll when 10 students concurrently attempt to join a 1-seat group', async () => {
    // Dispatch 10 simultaneous join requests
    const joinPromises = candidateStudents.map((student) =>
      request(app)
        .post('/api/v1/groups/join-by-code')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ groupCode: testGroup.groupCode })
    );

    const responses = await Promise.all(joinPromises);

    const successfulJoins = responses.filter((r) => r.status === 200 && r.body.success === true);
    const capacityRejectedJoins = responses.filter(
      (r) => r.status === 400 && r.body.message.includes('المجموعة ممتلئة بالكامل')
    );

    // EXACTLY 1 SUCCESS
    expect(successfulJoins.length).toBe(1);
    // EXACTLY 9 REJECTIONS
    expect(capacityRejectedJoins.length).toBe(9);

    // Verify in database: total active enrollments must be exactly 1
    const dbActiveCount = await prisma.groupEnrollment.count({
      where: {
        groupId: testGroup.id,
        status: 'ACTIVE',
      },
    });

    expect(dbActiveCount).toBe(1);
  });

  it('2. should reject duplicate join attempt by the already enrolled student (409 Conflict)', async () => {
    // Find the student who got the seat
    const enrolledRecord = await prisma.groupEnrollment.findFirst({
      where: { groupId: testGroup.id, status: 'ACTIVE' },
    });

    const successfulStudent = candidateStudents.find(
      (s) => s.user.studentProfile.id === enrolledRecord.studentId
    );

    const res = await request(app)
      .post('/api/v1/groups/join-by-code')
      .set('Authorization', `Bearer ${successfulStudent.token}`)
      .send({ groupCode: testGroup.groupCode });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('أنت منضم بالفعل');
  });

  it('3. should also reject direct joinGroupById when capacity is full (400 Bad Request)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${testGroup.id}/join`)
      .set('Authorization', `Bearer ${unenrolledStudent.token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('المجموعة ممتلئة بالكامل');
  });
});
