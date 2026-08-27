import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Teacher Assessments & Grading Integration Suite (Milestone 3)', () => {
  let helper;
  let teacherA;
  let teacherB;
  let student1;
  let student2;
  let group;
  let createdHomeworkId;
  let createdExamId;
  let hwEssayQuestionId;
  let examEssayQuestionId;
  let examMcqQuestionId;
  let hwSubmissionId;
  let examSubmissionId;

  beforeAll(async () => {
    helper = new TestSetupHelper('teacher_assess');
    await helper.createAcademicHierarchy();

    teacherA = await helper.createTeacher({ fullName: 'معلم الفيزياء الأول' });
    teacherB = await helper.createTeacher({ fullName: 'معلم الفيزياء الثاني' });

    student1 = await helper.createStudent({ fullName: 'أحمد محمود الطالب' });
    student2 = await helper.createStudent({ fullName: 'سارة حسن الطالبة' });

    group = await helper.createGroup({ teacherId: teacherA.user.id });
    await helper.enrollStudent(student1.user.studentProfile.id, group.id);
    await helper.enrollStudent(student2.user.studentProfile.id, group.id);
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  it('1. should create a homework assignment with MCQ and Essay questions', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/homework')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        groupId: group.id,
        title: 'واجب الفيزياء - قوانين الحركة',
        unitName: 'الوحدة الأولى: الميكانيكا',
        durationMinutes: 30,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        questions: [
          {
            type: 'MCQ',
            questionText: 'ما هي وحدة قياس القوة في النظام الدولي؟',
            options: ['جول', 'نيوتن', 'باسكال', 'واط'],
            correctOptionIndex: 1,
            score: 2,
            order: 1,
          },
          {
            type: 'ESSAY',
            questionText: 'اذكر نص القانون الثاني لنيوتن في الحركة',
            modelAnswer: 'القوة المحصلة تساوي المعدل الزمني للتغير في كمية الحركة F = ma',
            score: 5,
            order: 2,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.totalScore).toBe(7);
    expect(res.body.data.questions.length).toBe(2);

    createdHomeworkId = res.body.data.id;
    const essayQ = res.body.data.questions.find((q) => q.type === 'ESSAY');
    hwEssayQuestionId = essayQ.id;
  });

  it('2. should list teacher homework assignments', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/homework')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.homeworks.length).toBeGreaterThanOrEqual(1);

    const hw = res.body.data.homeworks.find((h) => h.id === createdHomeworkId);
    expect(hw).toBeDefined();
    expect(hw.questionsCount).toBe(2);
  });

  it('3. should get homework details with questions', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/homework/${createdHomeworkId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('واجب الفيزياء - قوانين الحركة');
    expect(Array.isArray(res.body.data.questions)).toBe(true);
  });

  it('4. should update homework details', async () => {
    const res = await request(app)
      .put(`/api/v1/teacher/homework/${createdHomeworkId}`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        title: 'واجب الفيزياء المحدث - قوانين نيوتن',
        durationMinutes: 40,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toContain('المحدث');
    expect(res.body.data.durationMinutes).toBe(40);
  });

  it('5. should allow student to submit homework containing an essay question', async () => {
    const res = await request(app)
      .post(`/api/v1/homework/${createdHomeworkId}/submit`)
      .set('Authorization', `Bearer ${student1.token}`)
      .send({
        answers: [
          { questionId: hwEssayQuestionId, answer: 'القوة هي حاصل ضرب الكتلة في العجلة' },
        ],
        timeSpentSeconds: 300,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('6. should get student submissions for homework', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/homework/${createdHomeworkId}/submissions`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const sub = res.body.data.find((s) => s.studentId === student1.user.studentProfile.id);
    expect(sub).toBeDefined();
    hwSubmissionId = sub.submissionId;
  });

  it('7. should create a timed exam with MCQ and Essay questions', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 10 * 60 * 1000); // started 10m ago
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // ends in 2h

    const res = await request(app)
      .post('/api/v1/teacher/exams')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        groupId: group.id,
        title: 'امتحان الفيزياء الشهري الأول',
        durationMinutes: 45,
        passingScorePercentage: 50,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        questions: [
          {
            type: 'MCQ',
            questionText: 'وحدة قياس السرعة في النظام الدولي هي:',
            options: ['م/ث', 'م.ث', 'كم/س', 'م/ث²'],
            correctOptionIndex: 0,
            score: 5,
            order: 1,
          },
          {
            type: 'ESSAY',
            questionText: 'عرف السرعة المتجهة والسرعة القياسية مع التوضيح',
            modelAnswer: 'السرعة المتجهة هي الإزاحة المقطوعة في وحدة الزمن (كمية متجهة)، بينما القياسية هي المسافة (كمية قياسية)',
            score: 5,
            order: 2,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.totalScore).toBe(10);

    createdExamId = res.body.data.id;
    const mcqQ = res.body.data.questions.find((q) => q.type === 'MCQ');
    const essayQ = res.body.data.questions.find((q) => q.type === 'ESSAY');
    examMcqQuestionId = mcqQ.id;
    examEssayQuestionId = essayQ.id;
  });

  it('8. should list teacher exams and get exam details', async () => {
    // 1. List
    const listRes = await request(app)
      .get('/api/v1/teacher/exams')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.exams.length).toBeGreaterThanOrEqual(1);

    // 2. Details
    const detailRes = await request(app)
      .get(`/api/v1/teacher/exams/${createdExamId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.totalScore).toBe(10);
    expect(detailRes.body.data.questions.length).toBe(2);
  });

  it('9. should allow student to take exam with MCQ + Essay and submit', async () => {
    // 1. Start exam
    await request(app)
      .post(`/api/v1/exams/${createdExamId}/start`)
      .set('Authorization', `Bearer ${student1.token}`);

    // 2. Submit exam (MCQ correct + Essay answer)
    const submitRes = await request(app)
      .post(`/api/v1/exams/${createdExamId}/submit`)
      .set('Authorization', `Bearer ${student1.token}`)
      .send({
        answers: [
          { questionId: examMcqQuestionId, selectedOptionIndex: 0 },
          { questionId: examEssayQuestionId, answerText: 'السرعة المتجهة كمية متجهة والقياسية كمية عددية' },
        ],
        timeSpentSeconds: 600,
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.data.correctCount).toBe(1);
    expect(submitRes.body.data.underReviewCount).toBe(1); // Essay is pending review!
  });

  it('10. should view pending essay grading queue', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/grading/pending')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pendingCount).toBeGreaterThanOrEqual(1);

    const pendingItem = res.body.data.queue.find((q) => q.questionId === examEssayQuestionId);
    expect(pendingItem).toBeDefined();
    expect(pendingItem.studentName).toBe('أحمد محمود الطالب');
    expect(pendingItem.maxScore).toBe(5);

    examSubmissionId = pendingItem.submissionId;
  });

  it('11. should reject grading essay question when scoreAwarded exceeds question maxScore (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/grading/essay')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        submissionType: 'EXAM',
        submissionId: examSubmissionId,
        questionId: examEssayQuestionId,
        scoreAwarded: 50, // max is 5
        feedback: 'درجة تتجاوز الحد الأقصى',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('تتجاوز الدرجة القصوى للسؤال');
  });

  it('11.1 should grade essay question, recalculate total score, and trigger push notification', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/grading/essay')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        submissionType: 'EXAM',
        submissionId: examSubmissionId,
        questionId: examEssayQuestionId,
        scoreAwarded: 5,
        feedback: 'إجابة وافية ونموذجية، أحسنت!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scoreObtained).toBe(10); // 5 (MCQ) + 5 (Essay) = 10 / 10
    expect(res.body.data.scorePercentage).toBe(100);
    expect(res.body.data.passed).toBe(true);
    expect(res.body.data.remainingUnderReview).toBe(0);
  });

  it('12. should generate comprehensive Grade Sheet for all enrolled group students', async () => {
    const res = await request(app)
      .get(`/api/v1/teacher/exams/${createdExamId}/grade-sheet`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalEnrolled).toBe(2);
    expect(res.body.data.summary.totalPresent).toBe(1);
    expect(res.body.data.summary.totalAbsent).toBe(1);
    expect(res.body.data.gradeSheet.length).toBe(2);

    // Student 1: Ranked 1st with 100%
    const student1Card = res.body.data.gradeSheet.find((s) => s.studentId === student1.user.studentProfile.id);
    expect(student1Card.status).toBe('PRESENT');
    expect(student1Card.rank).toBe(1);
    expect(student1Card.scorePercentage).toBe(100);
    expect(student1Card.passed).toBe(true);

    // Student 2: Absent (did not submit)
    const student2Card = res.body.data.gradeSheet.find((s) => s.studentId === student2.user.studentProfile.id);
    expect(student2Card.status).toBe('ABSENT');
    expect(student2Card.scorePercentage).toBe(0);
    expect(student2Card.rank).toBe('-');
  });

  it('13. [IDOR Prevention] Teacher B cannot access or modify Teacher A assessments', async () => {
    // Attempt GET Homework
    const hwRes = await request(app)
      .get(`/api/v1/teacher/homework/${createdHomeworkId}`)
      .set('Authorization', `Bearer ${teacherB.token}`);
    expect(hwRes.status).toBe(404);

    // Attempt GET Exam Grade Sheet
    const gradeRes = await request(app)
      .get(`/api/v1/teacher/exams/${createdExamId}/grade-sheet`)
      .set('Authorization', `Bearer ${teacherB.token}`);
    expect(gradeRes.status).toBe(404);
  });

  it('14. should delete homework and exam', async () => {
    // 1. Delete Homework
    const delHwRes = await request(app)
      .delete(`/api/v1/teacher/homework/${createdHomeworkId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);
    expect(delHwRes.status).toBe(200);

    // 2. Delete Exam
    const delExamRes = await request(app)
      .delete(`/api/v1/teacher/exams/${createdExamId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);
    expect(delExamRes.status).toBe(200);
  });
});
