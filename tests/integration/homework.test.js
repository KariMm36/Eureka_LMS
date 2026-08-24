import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Homework Module Integration Tests', () => {
  const helper = new TestSetupHelper('hw_suite');

  let student;
  let testGroup;
  let testHomework;
  let mcqQuestion;
  let essayQuestion;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    student = await helper.createUser({ role: 'STUDENT', fullName: 'طالب اختبارات الواجبات' });
    testGroup = await helper.createGroup();
    await helper.enrollStudent(student.user.studentProfile.id, testGroup.id);

    testHomework = await helper.createHomework({
      groupId: testGroup.id,
      totalScore: 20,
      minWords: 8, // Requires at least 8 words for essay
    });

    mcqQuestion = testHomework.questions.find((q) => q.type === 'MCQ');
    essayQuestion = testHomework.questions.find((q) => q.type === 'ESSAY');
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  describe('1. Homework Feed (GET /api/v1/homework)', () => {
    it('should return homework in pending tab before submission', async () => {
      const res = await request(app)
        .get('/api/v1/homework')
        .set('Authorization', `Bearer ${student.token}`)
        .query({ status: 'pending' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((hw) => hw.id === testHomework.id)).toBe(true);
    });
  });

  describe('2. Fetch Questions for Taking (GET /api/v1/homework/:id)', () => {
    it('should return questions with parsed options and strip correct answers from student view', async () => {
      const res = await request(app)
        .get(`/api/v1/homework/${testHomework.id}`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testHomework.id);
      expect(res.body.data.questions.length).toBe(2);

      const receivedMCQ = res.body.data.questions.find((q) => q.type === 'MCQ');
      expect(receivedMCQ).toBeDefined();
      expect(Array.isArray(receivedMCQ.options)).toBe(true);
      // Security Check: Correct answer index must NOT be leaked during taking
      expect(receivedMCQ.correctOptionIndex).toBeUndefined();
    });
  });


  describe('3. Essay minWords Validation on Submit (POST /api/v1/homework/:id/submit)', () => {
    it('should reject submission if essay word count is BELOW minWords (400 Bad Request)', async () => {
      const answers = [
        {
          questionId: mcqQuestion.id,
          selectedOption: 0, // Correct answer
          timeSpentSeconds: 15,
        },
        {
          questionId: essayQuestion.id,
          essayText: 'قانون نيوتن الأول فقط', // 4 words (Required: 8 words)
          timeSpentSeconds: 25,
        },
      ];

      const res = await request(app)
        .post(`/api/v1/homework/${testHomework.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({ answers });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('الحد الأدنى المطلوب 8 كلمة');
    });

    it('should reject submission if essay is empty (400 Bad Request)', async () => {
      const answers = [
        {
          questionId: mcqQuestion.id,
          selectedOption: 0,
        },
        {
          questionId: essayQuestion.id,
          essayText: '   ',
        },
      ];

      const res = await request(app)
        .post(`/api/v1/homework/${testHomework.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({ answers });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('يجب كتابة إجابة مقالية');
    });
  });

  describe('4. Successful Homework Submission & Auto-Grading (POST /api/v1/homework/:id/submit)', () => {
    it('should auto-grade MCQ, flag essay as UNDER_REVIEW, compute percentile, and create notification', async () => {
      const validAnswers = [
        {
          questionId: mcqQuestion.id,
          selectedOption: 0, // Correct answer (Score: 10/10)
          timeSpentSeconds: 20,
        },
        {
          questionId: essayQuestion.id,
          essayText: 'ينص قانون نيوتن الأول على أن الجسم الساكن يبقى ساكنا والمتحرك يستمر في حركته ما لم تؤثر قوة', // 17 words (>= 8)
          timeSpentSeconds: 40,
        },
      ];

      const res = await request(app)
        .post(`/api/v1/homework/${testHomework.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers: validAnswers,
          timeAnalytics: {
            averageTimePerQuestionSec: 30,
            fastestQuestionSec: 20,
            slowestQuestionSec: 40,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScoreObtained).toBe(10); // MCQ = 10, Essay = 0 pending review
      expect(res.body.data.correctCount).toBe(1);
      expect(res.body.data.underReviewCount).toBe(1);
      expect(res.body.data.status).toBe('UNDER_REVIEW');
      expect(res.body.data.percentileText).toBeDefined();

      // Verify automated notification record created in DB
      const notification = await prisma.notification.findFirst({
        where: { userId: student.user.id, type: 'HOMEWORK', referenceId: testHomework.id },
      });
      expect(notification).not.toBeNull();
      expect(notification.body).toContain(testHomework.title);
    });

    it('should reject double submission for completed homework (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/homework/${testHomework.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers: [{ questionId: mcqQuestion.id, selectedOption: 0 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('لقد قمت بتسليم هذا الواجب مسبقاً');
    });
  });

  describe('5. Homework Result Scorecard (GET /api/v1/homework/:id/result)', () => {
    it('should return detailed scorecard with score metrics and reviewed answers', async () => {
      const res = await request(app)
        .get(`/api/v1/homework/${testHomework.id}/result`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScoreObtained).toBe(10);
      expect(res.body.data.totalScoreMax).toBe(20);
      expect(Array.isArray(res.body.data.answersReview)).toBe(true);
      expect(res.body.data.answersReview.length).toBe(2);
      expect(res.body.data.percentileText).toBeDefined();
    });
  });
});

