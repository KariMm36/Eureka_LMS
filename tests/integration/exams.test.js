import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Exams Module Integration Tests', () => {
  const helper = new TestSetupHelper('exams_suite');

  let student;
  let testGroup;
  let activeExam;
  let futureExam;
  let pastExam;
  let activeMCQ;
  let activeEssay;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    student = await helper.createUser({ role: 'STUDENT', fullName: 'طالب اختبارات الامتحانات' });
    testGroup = await helper.createGroup();
    await helper.enrollStudent(student.user.studentProfile.id, testGroup.id);

    // 1. Active Exam (Started 10 mins ago, Ends in 60 mins)
    activeExam = await helper.createExam({
      groupId: testGroup.id,
      windowType: 'ACTIVE',
      totalScore: 30,
      minWords: 10,
    });
    activeMCQ = activeExam.questions.find((q) => q.type === 'MCQ');
    activeEssay = activeExam.questions.find((q) => q.type === 'ESSAY');

    // 2. Future Exam (Starts tomorrow)
    futureExam = await helper.createExam({
      groupId: testGroup.id,
      windowType: 'FUTURE',
    });

    // 3. Past Exam (Ended yesterday)
    pastExam = await helper.createExam({
      groupId: testGroup.id,
      windowType: 'PAST',
    });
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  describe('1. Exams Feed (GET /api/v1/exams)', () => {
    it('should return list of exams for enrolled group with status badges', async () => {
      const res = await request(app)
        .get('/api/v1/exams')
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const foundActive = res.body.data.find((e) => e.id === activeExam.id);
      expect(foundActive).toBeDefined();
      expect(foundActive.statusKey).toBe('AVAILABLE');

      const foundFuture = res.body.data.find((e) => e.id === futureExam.id);
      expect(foundFuture).toBeDefined();
      expect(foundFuture.statusKey).toBe('UPCOMING');
    });
  });

  describe('2. Exam Instructions & Guidelines (GET /api/v1/exams/:id/instructions)', () => {
    it('should return exam rules, palette legend, and duration', async () => {
      const res = await request(app)
        .get(`/api/v1/exams/${activeExam.id}/instructions`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.examId).toBe(activeExam.id);
      expect(res.body.data.durationMinutes).toBe(activeExam.durationMinutes);
      expect(res.body.data.legend).toBeDefined();
      expect(res.body.data.legend.answered).toBeDefined();
    });
  });

  describe('3. Time Window Enforcement on Start Session (POST /api/v1/exams/:id/start)', () => {
    it('TIME WINDOW BAD PATH: should REJECT starting a FUTURE exam before scheduled startTime (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${futureExam.id}/start`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('الامتحان لم يبدأ بعد');
    });

    it('TIME WINDOW BAD PATH: should REJECT starting a PAST exam after scheduled endTime (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${pastExam.id}/start`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('انتهت فترة الامتحان');
    });

    it('TIME WINDOW HAPPY PATH: should allow starting ACTIVE exam and return serverTime + questions', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${activeExam.id}/start`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.examId).toBe(activeExam.id);
      expect(res.body.data.serverTime).toBeDefined();
      expect(res.body.data.durationMinutes).toBe(activeExam.durationMinutes);
      expect(res.body.data.questions.length).toBe(2);

      // Verify correct answers are NOT leaked in question payload
      expect(res.body.data.questions[0].correctOptionIndex).toBeUndefined();
      expect(res.body.data.questions[0].explanation).toBeUndefined();
    });
  });


  describe('4. Exam Submission & Result Report (POST /api/v1/exams/:id/submit)', () => {
    it('should reject essay submission if word count is BELOW minWords (400)', async () => {
      const answers = [
        { questionId: activeMCQ.id, selectedOption: 0, timeSpentSeconds: 15 },
        { questionId: activeEssay.id, essayText: 'إجابة قصيرة جداً', timeSpentSeconds: 10 }, // 3 words (< 10)
      ];

      const res = await request(app)
        .post(`/api/v1/exams/${activeExam.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({ answers });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('الحد الأدنى المطلوب 10 كلمة');
    });

    it('should successfully submit exam, auto-grade MCQ, and return score + percentile', async () => {
      const answers = [
        {
          questionId: activeMCQ.id,
          selectedOption: 0, // Correct answer (Score: 15/15)
          paletteStatus: 'ANSWERED',
          timeSpentSeconds: 25,
        },
        {
          questionId: activeEssay.id,
          essayText: 'تسقط جميع الأجسام في الفراغ بنفس التسارع بغض النظر عن كتلتها لعدم وجود مقاومة هواء تؤثر عليها', // 17 words (>= 10)
          paletteStatus: 'ANSWERED',
          timeSpentSeconds: 45,
        },
      ];

      const res = await request(app)
        .post(`/api/v1/exams/${activeExam.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers,
          timeAnalytics: {
            averageTimePerQuestionSec: 35,
            fastestQuestionSec: 25,
            slowestQuestionSec: 45,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScoreObtained).toBe(15); // MCQ = 15, Essay = pending review
      expect(res.body.data.totalScoreMax).toBe(30);
      expect(res.body.data.percentileText).toBeDefined();

      // Verify notification in DB
      const notification = await prisma.notification.findFirst({
        where: { userId: student.user.id, type: 'EXAM', referenceId: activeExam.id },
      });
      expect(notification).not.toBeNull();
      expect(notification.body).toContain(activeExam.title);
    });

    it('should reject double submission of completed exam (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${activeExam.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers: [{ questionId: activeMCQ.id, selectedOption: 0 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('لقد قمت بإنهاء هذا الامتحان مسبقاً');
    });
  });

  describe('5. Exam Result Report Card (GET /api/v1/exams/:id/result)', () => {
    it('should return comprehensive report card with pass/fail and question review', async () => {
      const res = await request(app)
        .get(`/api/v1/exams/${activeExam.id}/result`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScoreObtained).toBe(15);
      expect(res.body.data.totalScoreMax).toBe(30);
      expect(res.body.data.percentileBadge).toBeDefined();
      expect(Array.isArray(res.body.data.answersReview)).toBe(true);
    });
  });
});
