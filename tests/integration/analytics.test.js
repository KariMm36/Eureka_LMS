import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Student Analytics Module Integration Tests', () => {
  const helper = new TestSetupHelper('analytics_suite');

  let topStudent;
  let averageStudent;
  let teacherUser;
  let testGroup;
  let testHomework;
  let testExam;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    teacherUser = await helper.createUser({ role: 'TEACHER', fullName: 'معلم تحليلات' });
    testGroup = await helper.createGroup({ teacherId: teacherUser.user.id });

    testHomework = await helper.createHomework({ groupId: testGroup.id, totalScore: 20 });
    testExam = await helper.createExam({ groupId: testGroup.id, totalScore: 100 });

    // Create 4 ranked students in the group with varied scores for real peer comparison
    const rankedStudents = await helper.createGroupWithRankedStudents(testGroup.id, testHomework.id);
    topStudent = rankedStudents[0];     // Expected score: 95%
    averageStudent = rankedStudents[2]; // Expected score: 60%

    // Add exam submission for topStudent (score: 90%)
    await prisma.examSubmission.create({
      data: {
        examId: testExam.id,
        studentId: topStudent.user.studentProfile.id,
        answersJson: JSON.stringify([]),
        totalScoreObtained: 90,
        scorePercentage: 90,
        passed: true,
        correctCount: 6,
        wrongCount: 0,
        underReviewCount: 0,
      },
    });

    // Add exam submission for averageStudent (score: 65%)
    await prisma.examSubmission.create({
      data: {
        examId: testExam.id,
        studentId: averageStudent.user.studentProfile.id,
        answersJson: JSON.stringify([]),
        totalScoreObtained: 65,
        scorePercentage: 65,
        passed: true,
        correctCount: 4,
        wrongCount: 2,
        underReviewCount: 0,
      },
    });
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  describe('1. Student Analytics Metrics (GET /api/v1/students/analytics)', () => {
    it('should return aggregated metrics, completion rates, and top rank badge for top student', async () => {
      const res = await request(app)
        .get('/api/v1/students/analytics')
        .set('Authorization', `Bearer ${topStudent.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Homework Analytics
      const hw = res.body.data.homeworkAnalytics;
      expect(hw).toBeDefined();
      expect(hw.completed).toBe(1);
      expect(hw.completionRatePercentage).toBeGreaterThan(0);
      expect(hw.averageScorePercentage).toBeGreaterThanOrEqual(90);

      // Exam Analytics
      const ex = res.body.data.examAnalytics;
      expect(ex).toBeDefined();
      expect(ex.completed).toBe(1);
      expect(ex.passed).toBe(1);
      expect(ex.overallAveragePercentage).toBe(90);

      // Rank Badge for top performer (>= 85%)
      expect(res.body.data.rankBadge).toContain('أعلى 15%');

      // Subject Performance Breakdown
      expect(Array.isArray(res.body.data.subjectStrengths)).toBe(true);
      expect(res.body.data.subjectStrengths.length).toBeGreaterThan(0);
      expect(res.body.data.subjectStrengths[0].performancePercentage).toBeGreaterThanOrEqual(90);
      expect(res.body.data.subjectStrengths[0].status).toBe('ممتاز');
    });

    it('should return accurate metrics and lower rank badge for average student', async () => {
      const res = await request(app)
        .get('/api/v1/students/analytics')
        .set('Authorization', `Bearer ${averageStudent.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.examAnalytics.overallAveragePercentage).toBe(65);
      expect(res.body.data.rankBadge).toContain('واصل المحاولة');
    });
  });

  describe('2. Security & Role Guards', () => {
    it('should reject unauthenticated request without token (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/students/analytics');
      expect(res.status).toBe(401);
    });

    it('should reject non-student role from accessing student analytics (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/students/analytics')
        .set('Authorization', `Bearer ${teacherUser.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
