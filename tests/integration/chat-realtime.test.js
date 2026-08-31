import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { initSocket, closeSocket } from '../../src/config/socket.config.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Socket.IO Real-Time 1-on-1 Chat Suite', () => {
  const helper = new TestSetupHelper('chat_realtime_suite');
  let httpServer;
  let serverPort;
  let serverUrl;

  let teacherA;
  let teacherB;
  let studentA;
  let studentB;
  let groupA;
  let conversationA;

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

    // 2. Create Group A for Teacher A
    groupA = await helper.createGroup({ teacherId: teacherA.user.id });

    // 3. Enroll Student A in Group A (ACTIVE)
    await helper.enrollStudent(studentA.user.studentProfile.id, groupA.id, 'ACTIVE');

    // 4. Create Conversation A in database
    conversationA = await prisma.conversation.create({
      data: {
        groupId: groupA.id,
        studentId: studentA.user.id,
        teacherId: teacherA.user.id,
      },
    });

    // 5. Start ephemeral test HTTP server with Socket.IO attached
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

  describe('1. Real-Time Student ↔ Teacher Messaging', () => {
    it('1.1 should deliver student:send_message in real-time to teacher personal room user:{teacherId}', async () => {
      const studentSocket = createClientSocket(studentA.token);
      const teacherSocketA = createClientSocket(teacherA.token);
      const teacherSocketB = createClientSocket(teacherB.token);

      // Wait for sockets to connect
      await Promise.all([
        new Promise((resolve) => studentSocket.on('connection:ready', resolve)),
        new Promise((resolve) => teacherSocketA.on('connection:ready', resolve)),
        new Promise((resolve) => teacherSocketB.on('connection:ready', resolve)),
      ]);

      let teacherBReceived = false;
      teacherSocketB.on('chat:new_message', () => {
        teacherBReceived = true;
      });

      const messageContent = 'مرحباً يا مستر، هل الدرس القادم أونلاين؟';

      const receivedByTeacherA = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for chat:new_message on Teacher A')), 6000);

        teacherSocketA.on('chat:new_message', (msg) => {
          clearTimeout(timeout);
          resolve(msg);
        });

        // Student emits message via Socket.IO
        studentSocket.emit('student:send_message', {
          conversationId: conversationA.id,
          content: messageContent,
        });
      });

      expect(receivedByTeacherA).toBeDefined();
      expect(receivedByTeacherA.content).toBe(messageContent);
      expect(receivedByTeacherA.sender.id).toBe(studentA.user.id);
      expect(receivedByTeacherA.conversationId).toBe(conversationA.id);

      // Verify room isolation: Teacher B received NOTHING
      expect(teacherBReceived).toBe(false);

      // Verify message was persisted to MySQL database
      const msgInDb = await prisma.chatMessage.findFirst({
        where: { conversationId: conversationA.id, content: messageContent },
      });
      expect(msgInDb).not.toBeNull();
      expect(msgInDb.senderId).toBe(studentA.user.id);
    });

    it('1.2 should deliver teacher:send_message in real-time to student personal room user:{studentId}', async () => {
      const studentSocket = createClientSocket(studentA.token);
      const teacherSocket = createClientSocket(teacherA.token);

      await Promise.all([
        new Promise((resolve) => studentSocket.on('connection:ready', resolve)),
        new Promise((resolve) => teacherSocket.on('connection:ready', resolve)),
      ]);

      const teacherReply = 'نعم يا عمر، الدرس القادم سيكون بث مباشر الساعة 5';

      const receivedByStudent = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for chat:new_message on Student A')), 6000);

        studentSocket.on('chat:new_message', (msg) => {
          clearTimeout(timeout);
          resolve(msg);
        });

        // Teacher emits reply via Socket.IO
        teacherSocket.emit('teacher:send_message', {
          conversationId: conversationA.id,
          content: teacherReply,
        });
      });

      expect(receivedByStudent).toBeDefined();
      expect(receivedByStudent.content).toBe(teacherReply);
      expect(receivedByStudent.sender.id).toBe(teacherA.user.id);
      expect(receivedByStudent.sender.role).toBe('TEACHER');
    });

    it('1.3 should reject unauthorized student sending message to unauthorized conversation', async () => {
      const unauthorizedStudentSocket = createClientSocket(studentB.token);

      await new Promise((resolve) => unauthorizedStudentSocket.on('connection:ready', resolve));

      const errorEvent = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for error event')), 5000);

        unauthorizedStudentSocket.on('error', (err) => {
          clearTimeout(timeout);
          resolve(err);
        });

        unauthorizedStudentSocket.emit('student:send_message', {
          conversationId: conversationA.id,
          content: 'محاولة اختراق',
        });
      });

      expect(errorEvent.success).toBe(false);
    });

    it('1.4 should emit chat:messages_read when user marks conversation as read', async () => {
      const studentSocket = createClientSocket(studentA.token);
      const teacherSocket = createClientSocket(teacherA.token);

      await Promise.all([
        new Promise((resolve) => studentSocket.on('connection:ready', resolve)),
        new Promise((resolve) => teacherSocket.on('connection:ready', resolve)),
      ]);

      const readReceipt = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for chat:messages_read on Teacher')), 6000);

        teacherSocket.on('chat:messages_read', (receipt) => {
          clearTimeout(timeout);
          resolve(receipt);
        });

        // Student marks conversation as read via Socket.IO
        studentSocket.emit('chat:message_read', {
          conversationId: conversationA.id,
        });
      });

      expect(readReceipt.conversationId).toBe(conversationA.id);
      expect(readReceipt.readBy).toBe(studentA.user.id);
    });
  });
});
