import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Notifications Module Integration Tests', () => {
  const helper = new TestSetupHelper('notif_suite');

  let student;
  let testGroup;
  let testHomework;
  let testNotificationId;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    student = await helper.createUser({ role: 'STUDENT', fullName: 'طالب اختبارات الإشعارات' });
    testGroup = await helper.createGroup();
    await helper.enrollStudent(student.user.studentProfile.id, testGroup.id);

    testHomework = await helper.createHomework({
      groupId: testGroup.id,
      totalScore: 10,
    });
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  describe('1. Auto-creation of Notifications on Submissions', () => {
    it('should create an in-app notification when student submits homework', async () => {
      const mcqQuestion = testHomework.questions.find((q) => q.type === 'MCQ');
      const essayQuestion = testHomework.questions.find((q) => q.type === 'ESSAY');

      // Submit homework with sufficient essay words (>= 10 words)
      const res = await request(app)
        .post(`/api/v1/homework/${testHomework.id}/submit`)
        .set('Authorization', `Bearer ${student.token}`)
        .send({
          answers: [
            { questionId: mcqQuestion.id, selectedOption: 0 },
            { questionId: essayQuestion.id, essayText: 'ينص قانون نيوتن الأول على أن الجسم الساكن يبقى ساكنا والمتحرك يستمر في حركته ما لم تؤثر قوة' },
          ],
        });

      expect(res.status).toBe(200);


      // Verify in-app notification record was created
      const notification = await prisma.notification.findFirst({
        where: { userId: student.user.id, type: 'HOMEWORK' },
      });

      expect(notification).not.toBeNull();
      expect(notification.title).toContain('تسليم الواجب بنجاح');
      expect(notification.isRead).toBe(false);

      testNotificationId = notification.id;
    });
  });

  describe('2. Fetch Notifications Feed (GET /api/v1/notifications)', () => {
    it('should return list of notifications with unread badge count', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
      expect(res.body.data.notifications.some((n) => n.id === testNotificationId)).toBe(true);
    });

    it('should filter notifications by unread status', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${student.token}`)
        .query({ filter: 'unread' });

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.every((n) => n.isRead === false)).toBe(true);
    });
  });

  describe('3. Notification Details & Auto-Read (GET /api/v1/notifications/:id)', () => {
    it('should fetch notification detail and automatically mark it as read (isRead: true)', async () => {
      const res = await request(app)
        .get(`/api/v1/notifications/${testNotificationId}`)
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testNotificationId);
      expect(res.body.data.isRead).toBe(true);

      // Verify updated in DB
      const updated = await prisma.notification.findUnique({ where: { id: testNotificationId } });
      expect(updated.isRead).toBe(true);
    });

    it('should return 404 for non-existent notification ID', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/non-existent-uuid-1234')
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Mark All As Read (PATCH /api/v1/notifications/read-all)', () => {
    it('should mark all unread notifications for student as read', async () => {
      // Create a second unread notification manually
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          title: 'إشعار ثاني تجريبي',
          body: 'محتوى الإشعار الثاني',
          type: 'ANNOUNCEMENT',
          isRead: false,
        },
      });

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${student.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify zero unread notifications remain
      const unreadCount = await prisma.notification.count({
        where: { userId: student.user.id, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });
  });

  describe('5. Register Mobile FCM Token (POST /api/v1/notifications/fcm-token)', () => {
    it('should save Firebase FCM device token on user record', async () => {
      const sampleFcmToken = 'fcm_sample_device_token_xyz_1234567890_test';

      const res = await request(app)
        .post('/api/v1/notifications/fcm-token')
        .set('Authorization', `Bearer ${student.token}`)
        .send({ fcmToken: sampleFcmToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in DB
      const user = await prisma.user.findUnique({ where: { id: student.user.id } });
      expect(user.fcmToken).toBe(sampleFcmToken);
    });
  });
});
