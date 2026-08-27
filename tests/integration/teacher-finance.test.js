import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Teacher Finance Ledger & Broadcast Announcements Suite (Milestone 4)', () => {
  let helper;
  let teacherA;
  let teacherB;
  let student1;
  let student2;
  let group;
  let recordedPaymentId;

  beforeAll(async () => {
    helper = new TestSetupHelper('teacher_finance');
    await helper.createAcademicHierarchy();

    teacherA = await helper.createTeacher({ fullName: 'أستاذ الرياضيات الأول' });
    teacherB = await helper.createTeacher({ fullName: 'أستاذ الرياضيات الثاني' });

    student1 = await helper.createStudent({ fullName: 'عمر خالد الطالب' });
    student2 = await helper.createStudent({ fullName: 'مريم علي الطالبة' });

    group = await helper.createGroup({
      teacherId: teacherA.user.id,
      defaultPrice: 400,
    });

    await helper.enrollStudent(student1.user.studentProfile.id, group.id);
    await helper.enrollStudent(student2.user.studentProfile.id, group.id);
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  it('1. should get teacher financial summary KPIs before payments', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/finance/summary')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.kpis.totalEnrolledStudents).toBe(2);
    expect(res.body.data.kpis.totalExpectedMonthly).toBe(800); // 2 students * 400 LE
    expect(res.body.data.kpis.totalCollectedCurrentMonth).toBe(0);
    expect(res.body.data.kpis.totalPendingCurrentMonth).toBe(800);
    expect(res.body.data.kpis.collectionRatePercentage).toBe(0);
  });

  it('2. should get group financial roster showing unpaid students', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/finance/groups/${group.id}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalEnrolled).toBe(2);
    expect(res.body.data.summary.paidCount).toBe(0);
    expect(res.body.data.summary.unpaidCount).toBe(2);
    expect(res.body.data.students.length).toBe(2);

    const s1 = res.body.data.students.find((s) => s.studentId === student1.user.studentProfile.id);
    expect(s1.paymentStatus).toBe('UNPAID');
    expect(s1.enrollmentPrice).toBe(400);
  });

  it('3. should record a student fee payment receipt', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/finance/payments')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        studentId: student1.user.studentProfile.id,
        groupId: group.id,
        amount: 400,
        paymentMethod: 'INSTAPAY',
        notes: 'تم الدفع عبر انستاباي',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.amount).toBe(400);
    expect(res.body.data.paymentMethod).toBe('INSTAPAY');

    recordedPaymentId = res.body.data.id;
  });

  it('4. should update group financial roster reflecting the paid student', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/finance/groups/${group.id}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.paidCount).toBe(1);
    expect(res.body.data.summary.unpaidCount).toBe(1);
    expect(res.body.data.summary.collectedTotal).toBe(400);
    expect(res.body.data.summary.pendingTotal).toBe(400);
    expect(res.body.data.summary.collectionRatePercentage).toBe(50);

    const s1 = res.body.data.students.find((s) => s.studentId === student1.user.studentProfile.id);
    expect(s1.paymentStatus).toBe('PAID');
    expect(s1.paidAmount).toBe(400);
    expect(s1.paymentMethod).toBe('INSTAPAY');
  });

  it('5. should get payment history ledger with pagination and filter', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/finance/payments')
      .query({ groupId: group.id })
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payments.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalCollected).toBe(400);

    const payment = res.body.data.payments.find((p) => p.id === recordedPaymentId);
    expect(payment).toBeDefined();
    expect(payment.studentName).toBe('عمر خالد الطالب');
  });

  it('6. should dispatch broadcast announcement to group students', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/broadcast')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        targetType: 'GROUP',
        groupId: group.id,
        title: 'تنبيه بخصوص حصة المراجعة',
        body: 'يرجى إحضار كشكول المسائل والآلة الحاسبة في الحصة القادمة.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recipientCount).toBe(2);
  });

  it('7. should dispatch broadcast announcement to ALL teacher students', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/broadcast')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        targetType: 'ALL_MY_STUDENTS',
        title: 'تهنئة بالعام الدراسي الجديد',
        body: 'نتمنى لكم جميعاً عاماً دراسياً حافلاً بالتفوق والنجاح.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recipientCount).toBe(2);
  });

  it('8. [IDOR Prevention] Teacher B cannot access or record payments for Teacher A group', async () => {
    // 1. Get Group Finance Roster
    const rosterRes = await request(app)
      .get(`/api/v1/teacher/finance/groups/${group.id}`)
      .set('Authorization', `Bearer ${teacherB.token}`);
    expect(rosterRes.status).toBe(404);

    // 2. Record Payment
    const payRes = await request(app)
      .post('/api/v1/teacher/finance/payments')
      .set('Authorization', `Bearer ${teacherB.token}`)
      .send({
        studentId: student1.user.studentProfile.id,
        groupId: group.id,
        amount: 400,
      });
    expect(payRes.status).toBe(404);

    // 3. Delete Payment
    const delRes = await request(app)
      .delete(`/api/v1/teacher/finance/payments/${recordedPaymentId}`)
      .set('Authorization', `Bearer ${teacherB.token}`);
    expect(delRes.status).toBe(404);
  });

  it('9. should delete / cancel a recorded payment receipt', async () => {
    const res = await request(app)
      .delete(`/api/v1/teacher/finance/payments/${recordedPaymentId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is no longer in ledger
    const ledgerRes = await request(app)
      .get('/api/v1/teacher/finance/payments')
      .set('Authorization', `Bearer ${teacherA.token}`);

    const found = ledgerRes.body.data.payments.find((p) => p.id === recordedPaymentId);
    expect(found).toBeUndefined();
  });
});
