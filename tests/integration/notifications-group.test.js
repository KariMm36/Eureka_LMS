import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { initSocket, closeSocket } from '../../src/config/socket.config.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Phase 5 — Group Notifications & Frontend Integration Suite', () => {
  const helper = new TestSetupHelper('group_notif_suite');
  let httpServer;
  let serverPort;
  let serverUrl;

  let teacherA;
  let teacherB;
  let studentA;
  let studentB;
  let studentInactive;
  let groupA;
  let groupB;

  const openSockets = [];

  const createClientSocket = (token, options = {}) => {
    const socket = ioClient(serverUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...options,
    });
    openSockets.push(socket);
    return socket;
  };

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    // 1. Create Teachers and Students
    teacherA = await helper.createTeacher({ fullName: 'الأستاذ أحمد فوزي' });
    teacherB = await helper.createTeacher({ fullName: 'الأستاذ محمود إبراهيم' });
    studentA = await helper.createStudent({ fullName: 'الطالب عمر خالد' });
    studentB = await helper.createStudent({ fullName: 'الطالب ياسين طارق' });
    studentInactive = await helper.createStudent({ fullName: 'الطالب المنقطع كريم' });

    // 2. Create Group A (Teacher A) and Group B (Teacher B)
    groupA = await helper.createGroup({ teacherId: teacherA.user.id, name: 'مجموعة الفيزياء أ' });
    groupB = await helper.createGroup({ teacherId: teacherB.user.id, name: 'مجموعة الكيمياء ب' });

    // 3. Enroll Student A in Group A (ACTIVE)
    await helper.enrollStudent(studentA.user.studentProfile.id, groupA.id, 'ACTIVE');

    // 4. Enroll studentInactive in Group A (INACTIVE)
    await helper.enrollStudent(studentInactive.user.studentProfile.id, groupA.id, 'INACTIVE');

    // 5. Enroll Student B in Group B (ACTIVE)
    await helper.enrollStudent(studentB.user.studentProfile.id, groupB.id, 'ACTIVE');

    // 6. Start ephemeral test HTTP server with Socket.IO attached
    httpServer = http.createServer(app);
    await initSocket(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        serverUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const socket of openSockets) {
      if (socket.connected) socket.disconnect();
    }
    await closeSocket();
    if (httpServer && httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Teacher -> Group Targeted Notifications & Real-Time Socket Delivery
  // =========================================================================
  describe('1. Teacher Group Notifications & Real-Time Socket.IO Delivery', () => {
    it('1.1 should allow Teacher A to send group notification to Group A with real-time Socket delivery', async () => {
      const studentASocket = createClientSocket(studentA.token);
      const studentBSocket = createClientSocket(studentB.token);

      await Promise.all([
        new Promise((resolve) => studentASocket.on('connection:ready', resolve)),
        new Promise((resolve) => studentBSocket.on('connection:ready', resolve)),
      ]);

      let studentBReceived = false;
      studentBSocket.on('notification:new', () => {
        studentBReceived = true;
      });

      const notificationTitle = 'تغيير موعد المحاضرة';
      const notificationMessage = 'تم تغيير موعد محاضرة الفيزياء إلى الساعة 5:00 مساءً';

      const socketPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for notification:new on Student A')), 6000);
        studentASocket.on('notification:new', (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
      });

      // Teacher A dispatches group notification via REST API
      const res = await request(app)
        .post('/api/v1/teacher/notifications/group')
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({
          groupId: groupA.id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'GROUP_ANNOUNCEMENT',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipientCount).toBe(1); // Only Student A is ACTIVE; studentInactive is excluded
      expect(res.body.data.notification.title).toBe(notificationTitle);
      expect(res.body.data.group.id).toBe(groupA.id);

      // Verify real-time Socket event delivered to Student A
      const receivedSocketData = await socketPromise;
      expect(receivedSocketData.title).toBe(notificationTitle);
      expect(receivedSocketData.body).toBe(notificationMessage);

      // Verify Student B (different group) NEVER received the notification
      expect(studentBReceived).toBe(false);

      // Verify DB persistence for Student A
      const savedInDb = await prisma.notification.findFirst({
        where: { userId: studentA.user.id, title: notificationTitle },
      });
      expect(savedInDb).not.toBeNull();
      expect(savedInDb.body).toBe(notificationMessage);
      expect(savedInDb.isRead).toBe(false);

      // Verify inactive student did NOT get a DB notification
      const inactiveInDb = await prisma.notification.findFirst({
        where: { userId: studentInactive.user.id, title: notificationTitle },
      });
      expect(inactiveInDb).toBeNull();
    });

    it('1.2 should PREVENT IDOR: Teacher A cannot notify Group B owned by Teacher B (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/notifications/group')
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({
          groupId: groupB.id,
          title: 'محاولة إرسال لمجموعة معلم آخر',
          message: 'نص الرسالة',
        });

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('1.3 should reject student trying to invoke teacher notification endpoint (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/notifications/group')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({
          groupId: groupA.id,
          title: 'طالب يحاول إرسال إشعار',
          message: 'نص الرسالة',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Student Notification Feed & Read State Management
  // =========================================================================
  describe('2. Student Notifications API & IDOR Isolation', () => {
    let studentANotifId;

    it('2.1 should retrieve student notification feed with unread count and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?page=1&limit=20')
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);

      const targetNotif = res.body.data.notifications.find((n) => n.title === 'تغيير موعد المحاضرة');
      expect(targetNotif).toBeDefined();
      expect(targetNotif.isRead).toBe(false);
      studentANotifId = targetNotif.id;
    });

    it('2.2 should PREVENT IDOR: Student B cannot read Student A notification details (404/403)', async () => {
      const res = await request(app)
        .get(`/api/v1/notifications/${studentANotifId}`)
        .set('Authorization', `Bearer ${studentB.token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('2.3 should PREVENT IDOR: Student B cannot mark Student A notification as read (404/403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${studentANotifId}/read`)
        .set('Authorization', `Bearer ${studentB.token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Verify notification remains unread
      const notifInDb = await prisma.notification.findUnique({ where: { id: studentANotifId } });
      expect(notifInDb.isRead).toBe(false);
    });

    it('2.4 should allow Student A to mark own notification as read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${studentANotifId}/read`)
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const notifInDb = await prisma.notification.findUnique({ where: { id: studentANotifId } });
      expect(notifInDb.isRead).toBe(true);
    });

    it('2.5 should allow Student A to mark all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const unreadCount = await prisma.notification.count({
        where: { userId: studentA.user.id, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });
  });

  // =========================================================================
  // 3. Automatic Notifications on Group Schedule Change
  // =========================================================================
  describe('3. Automatic Schedule-Change Notification Hook', () => {
    it('3.1 should automatically dispatch notification when teacher updates group schedule time', async () => {
      const res = await request(app)
        .put(`/api/v1/teacher/groups/${groupA.id}`)
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({
          scheduleTime: '06:30 PM',
          scheduleDays: ['السبت', 'الثلاثاء'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify automatic notification was created in DB for active Student A
      const autoNotif = await prisma.notification.findFirst({
        where: {
          userId: studentA.user.id,
          title: '⏰ تغيير مواعيد المحاضرات',
        },
      });

      expect(autoNotif).not.toBeNull();
      expect(autoNotif.body).toContain('06:30 PM');
    });
  });
});
