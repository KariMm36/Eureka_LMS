import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { initSocket, closeSocket } from '../../src/config/socket.config.js';
import { signToken } from '../../src/utils/jwt.util.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../../src/config/env.config.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Socket.IO Real-Time Engine & Student -> Teacher Communication Suite', () => {
  const helper = new TestSetupHelper('socket_suite');
  let httpServer;
  let serverPort;
  let serverUrl;

  let teacherA;
  let teacherB;
  let studentA;
  let studentB;
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

    // 2. Create Groups: Group A (Teacher A), Group B (Teacher B)
    groupA = await helper.createGroup({ teacherId: teacherA.user.id });
    groupB = await helper.createGroup({ teacherId: teacherB.user.id });

    // 3. Enroll Student A ONLY in Group A
    await helper.enrollStudent(studentA.user.studentProfile.id, groupA.id, 'ACTIVE');

    // 4. Start ephemeral test HTTP server with Socket.IO attached
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
    // Close open client sockets
    for (const socket of openSockets) {
      if (socket.connected) socket.disconnect();
    }

    // Close Socket.IO server & HTTP server
    await closeSocket();
    if (httpServer && httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Handshake Authentication & Token Security
  // =========================================================================
  describe('1. Handshake Authentication & Security Guards', () => {
    it('1.1 should authenticate valid Student JWT and emit connection:ready with correct user data', async () => {
      const socket = createClientSocket(studentA.token);

      const readyData = await new Promise((resolve, reject) => {
        socket.on('connection:ready', resolve);
        socket.on('connect_error', (err) => reject(new Error(err.message)));
        setTimeout(() => reject(new Error('Handshake timeout')), 5000);
      });

      expect(readyData.success).toBe(true);
      expect(readyData.userId).toBe(studentA.user.id);
      expect(readyData.role).toBe('STUDENT');
      expect(socket.connected).toBe(true);
    });

    it('1.2 should authenticate valid Teacher JWT and emit connection:ready', async () => {
      const socket = createClientSocket(teacherA.token);

      const readyData = await new Promise((resolve, reject) => {
        socket.on('connection:ready', resolve);
        socket.on('connect_error', (err) => reject(new Error(err.message)));
        setTimeout(() => reject(new Error('Handshake timeout')), 5000);
      });

      expect(readyData.success).toBe(true);
      expect(readyData.userId).toBe(teacherA.user.id);
      expect(readyData.role).toBe('TEACHER');
    });

    it('1.3 should reject connection when JWT token is missing', async () => {
      const socket = createClientSocket(null);

      const errMessage = await new Promise((resolve, reject) => {
        socket.on('connect_error', (err) => resolve(err.message));
        socket.on('connection:ready', () => reject(new Error('Should have been rejected')));
        setTimeout(() => reject(new Error('Timeout waiting for rejection')), 5000);
      });

      expect(errMessage).toContain('Authentication failed: Token is missing');
      expect(socket.connected).toBe(false);
    });

    it('1.4 should reject connection when JWT token is forged/invalid', async () => {
      const socket = createClientSocket('invalid.forged.jwt-signature');

      const errMessage = await new Promise((resolve, reject) => {
        socket.on('connect_error', (err) => resolve(err.message));
        socket.on('connection:ready', () => reject(new Error('Should have been rejected')));
        setTimeout(() => reject(new Error('Timeout waiting for rejection')), 5000);
      });

      expect(errMessage).toContain('Authentication failed: Invalid token');
      expect(socket.connected).toBe(false);
    });

    it('1.5 should reject connection when JWT token is expired', async () => {
      const expiredToken = jwt.sign(
        { id: studentA.user.id, role: 'STUDENT', email: studentA.user.email },
        ENV.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const socket = createClientSocket(expiredToken);

      const errMessage = await new Promise((resolve, reject) => {
        socket.on('connect_error', (err) => resolve(err.message));
        socket.on('connection:ready', () => reject(new Error('Should have been rejected')));
        setTimeout(() => reject(new Error('Timeout waiting for rejection')), 5000);
      });

      expect(errMessage).toContain('Authentication failed: Token has expired');
      expect(socket.connected).toBe(false);
    });
  });

  // =========================================================================
  // 2. Student -> Teacher Communication Flow & Server-Side Authorization
  // =========================================================================
  describe('2. Student -> Teacher Communication & Relationship Routing', () => {
    it('2.1 should route message to the correct teacher and persist in MySQL when student is enrolled', async () => {
      const teacherASocket = createClientSocket(teacherA.token);
      const studentASocket = createClientSocket(studentA.token);

      // Wait for both to connect
      await Promise.all([
        new Promise((res) => teacherASocket.on('connection:ready', res)),
        new Promise((res) => studentASocket.on('connection:ready', res)),
      ]);

      const testMessageContent = 'يا مستر، هل يمكن إعادة شرح قانون نيوتن الثاني في الحصة القادمة؟';

      // Set up listener on Teacher A's socket
      const teacherReceivedPromise = new Promise((resolve, reject) => {
        teacherASocket.on('teacher:new_message', resolve);
        setTimeout(() => reject(new Error('Teacher A did not receive message in time')), 5000);
      });

      // Student A sends message to Group A
      const studentAckPromise = new Promise((resolve, reject) => {
        studentASocket.emit('student:send_message', {
          groupId: groupA.id,
          content: testMessageContent,
        }, (ack) => {
          if (ack.success) resolve(ack);
          else reject(new Error(ack.message));
        });
      });

      const [teacherPayload, ackPayload] = await Promise.all([
        teacherReceivedPromise,
        studentAckPromise,
      ]);

      // Verify Teacher received the full payload
      expect(teacherPayload.content).toBe(testMessageContent);
      expect(teacherPayload.student.id).toBe(studentA.user.id);
      expect(teacherPayload.student.fullName).toBe(studentA.user.fullName);
      expect(teacherPayload.group.id).toBe(groupA.id);
      expect(teacherPayload.id).toBeDefined();

      // Verify Student received delivery acknowledgement
      expect(ackPayload.success).toBe(true);
      expect(ackPayload.messageId).toBe(teacherPayload.id);

      // Verify message was durably persisted in MySQL Notification table
      const savedNotification = await prisma.notification.findUnique({
        where: { id: teacherPayload.id },
      });
      expect(savedNotification).toBeDefined();
      expect(savedNotification.userId).toBe(teacherA.user.id);
      expect(savedNotification.body).toBe(testMessageContent);
      expect(savedNotification.referenceId).toBe(groupA.id);
    });

    it('2.2 should REJECT communication if student is NOT enrolled in the target group', async () => {
      const teacherBSocket = createClientSocket(teacherB.token);
      const studentASocket = createClientSocket(studentA.token);

      await Promise.all([
        new Promise((res) => teacherBSocket.on('connection:ready', res)),
        new Promise((res) => studentASocket.on('connection:ready', res)),
      ]);

      let teacherBReceived = false;
      teacherBSocket.on('teacher:new_message', () => {
        teacherBReceived = true;
      });

      // Student A attempts to send message to Group B (Teacher B) where Student A is NOT enrolled
      const errorResponse = await new Promise((resolve) => {
        studentASocket.emit('student:send_message', {
          groupId: groupB.id,
          content: 'محاولة إرسال رسالة لمعلم في مجموعة غير مسجل بها',
        }, (ack) => {
          resolve(ack);
        });
      });

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toContain('غير مصرح لك بإرسال رسائل');

      // Wait 300ms to ensure Teacher B NEVER received any leaked event
      await new Promise((res) => setTimeout(res, 300));
      expect(teacherBReceived).toBe(false);
    });

    it('2.3 should PREVENT teacherId spoofing: server ignores client-supplied teacherId and uses DB relationship', async () => {
      const teacherASocket = createClientSocket(teacherA.token);
      const teacherBSocket = createClientSocket(teacherB.token);
      const studentASocket = createClientSocket(studentA.token);

      await Promise.all([
        new Promise((res) => teacherASocket.on('connection:ready', res)),
        new Promise((res) => teacherBSocket.on('connection:ready', res)),
        new Promise((res) => studentASocket.on('connection:ready', res)),
      ]);

      let teacherBReceived = false;
      teacherBSocket.on('teacher:new_message', () => {
        teacherBReceived = true;
      });

      const teacherAReceivedPromise = new Promise((resolve) => {
        teacherASocket.on('teacher:new_message', resolve);
      });

      // Malicious payload: Student supplies groupA.id but injects teacherB.user.id as teacherId
      studentASocket.emit('student:send_message', {
        groupId: groupA.id,
        teacherId: teacherB.user.id, // Malicious override attempt
        content: 'رسالة مع تزييف معرف المعلم المستهدف',
      });

      const teacherAPayload = await teacherAReceivedPromise;
      expect(teacherAPayload).toBeDefined();
      expect(teacherAPayload.group.id).toBe(groupA.id);

      // Verify Teacher B NEVER received the spoofed message
      await new Promise((res) => setTimeout(res, 300));
      expect(teacherBReceived).toBe(false);
    });

    it('2.4 should reject empty or whitespace-only content', async () => {
      const studentASocket = createClientSocket(studentA.token);
      await new Promise((res) => studentASocket.on('connection:ready', res));

      const errorResponse = await new Promise((resolve) => {
        studentASocket.emit('student:send_message', {
          groupId: groupA.id,
          content: '    ',
        }, resolve);
      });

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toContain('محتوى الرسالة');
    });

    it('2.5 should reject teacher socket attempting to emit student:send_message', async () => {
      const teacherASocket = createClientSocket(teacherA.token);
      await new Promise((res) => teacherASocket.on('connection:ready', res));

      const errorResponse = await new Promise((resolve) => {
        teacherASocket.emit('student:send_message', {
          groupId: groupA.id,
          content: 'معلم يحاول إرسال رسالة بصيغة طالب',
        }, resolve);
      });

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toContain('هذا الإجراء مخصص للطلاب فقط');
    });
  });
});
