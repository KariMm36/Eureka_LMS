import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Student ↔ Teacher 1-on-1 Chat HTTP API & Authorization Suite', () => {
  const helper = new TestSetupHelper('chat_http_suite');

  let teacherA;
  let teacherB;
  let studentA;
  let studentB;
  let groupA;
  let groupB;
  let conversationA;

  beforeAll(async () => {
    await helper.cleanup();
    await helper.createAcademicHierarchy();

    // 1. Create 2 Teachers and 2 Students
    teacherA = await helper.createTeacher({ fullName: 'الأستاذ أحمد فوزي' });
    teacherB = await helper.createTeacher({ fullName: 'الأستاذ محمود إبراهيم' });
    studentA = await helper.createStudent({ fullName: 'الطالب عمر خالد' });
    studentB = await helper.createStudent({ fullName: 'الطالب ياسين طارق' });

    // 2. Create Group A (Teacher A) and Group B (Teacher B)
    groupA = await helper.createGroup({ teacherId: teacherA.user.id, name: 'مجموعة الفيزياء أ' });
    groupB = await helper.createGroup({ teacherId: teacherB.user.id, name: 'مجموعة الكيمياء ب' });

    // 3. Enroll Student A in Group A (ACTIVE)
    await helper.enrollStudent(studentA.user.studentProfile.id, groupA.id, 'ACTIVE');

    // 4. Enroll Student B in Group B (ACTIVE)
    await helper.enrollStudent(studentB.user.studentProfile.id, groupB.id, 'ACTIVE');
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Conversation Creation & Authorization
  // =========================================================================
  describe('1. Conversation Creation & IDOR Protection', () => {
    it('1.1 should allow enrolled student to start/retrieve a conversation with their group teacher', async () => {
      const res = await request(app)
        .post('/api/v1/students/chat/conversations')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ groupId: groupA.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.groupId).toBe(groupA.id);
      expect(res.body.data.teacher.id).toBe(teacherA.user.id);
      expect(res.body.data.student.id).toBe(studentA.user.id);

      conversationA = res.body.data;
    });

    it('1.2 should return existing conversation if called again (idempotent)', async () => {
      const res = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ groupId: groupA.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(conversationA.id);
    });

    it('1.3 should reject student trying to chat with teacher of a group they are NOT enrolled in (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/students/chat/conversations')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ groupId: groupB.id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('غير مصرح لك');
    });

    it('1.4 should reject teacher trying to access student endpoint for conversation creation (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/students/chat/conversations')
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({ groupId: groupA.id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Sending Messages (HTTP Fallback)
  // =========================================================================
  describe('2. Message Sending & Metadata Updates', () => {
    it('2.1 should allow student to send a message to teacher in conversation', async () => {
      const res = await request(app)
        .post(`/api/v1/chat/conversations/${conversationA.id}/messages`)
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ content: 'مرحباً يا مستر، عندي سؤال في المسألة رقم 3' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.content).toBe('مرحباً يا مستر، عندي سؤال في المسألة رقم 3');
      expect(res.body.data.sender.id).toBe(studentA.user.id);
      expect(res.body.data.sender.role).toBe('STUDENT');
      expect(res.body.data.isRead).toBe(false);

      // Verify conversation unread count for teacher incremented in DB
      const convInDb = await prisma.conversation.findUnique({ where: { id: conversationA.id } });
      expect(convInDb.unreadByTeacher).toBe(1);
      expect(convInDb.unreadByStudent).toBe(0);
      expect(convInDb.lastMessage).toBe('مرحباً يا مستر، عندي سؤال في المسألة رقم 3');
    });

    it('2.2 should allow teacher to reply to student message in conversation', async () => {
      const res = await request(app)
        .post(`/api/v1/chat/conversations/${conversationA.id}/messages`)
        .set('Authorization', `Bearer ${teacherA.token}`)
        .send({ content: 'أهلاً يا عمر، اتفضل اسأل وسأشرحها لك بالتفصيل' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sender.id).toBe(teacherA.user.id);
      expect(res.body.data.sender.role).toBe('TEACHER');

      // Verify conversation unread count for student incremented in DB
      const convInDb = await prisma.conversation.findUnique({ where: { id: conversationA.id } });
      expect(convInDb.unreadByStudent).toBe(1);
      expect(convInDb.lastMessage).toBe('أهلاً يا عمر، اتفضل اسأل وسأشرحها لك بالتفصيل');
    });

    it('2.3 should reject empty or whitespace-only message content (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/v1/chat/conversations/${conversationA.id}/messages`)
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('2.4 should reject unauthorized teacher (Teacher B) trying to post in Teacher A conversation (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/chat/conversations/${conversationA.id}/messages`)
        .set('Authorization', `Bearer ${teacherB.token}`)
        .send({ content: 'متطفل يحاول إرسال رسالة' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('2.5 should reject unauthorized student (Student B) trying to post in Student A conversation (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/chat/conversations/${conversationA.id}/messages`)
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({ content: 'طالب آخر يحاول الإرسال' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Conversation Inboxes & Paginated Message History
  // =========================================================================
  describe('3. Inbox Retrieval & Paginated Message History', () => {
    it('3.1 should return conversation in Teacher A inbox with correct unread count', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/chat/conversations')
        .set('Authorization', `Bearer ${teacherA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.conversations)).toBe(true);
      expect(res.body.data.conversations.length).toBeGreaterThan(0);

      const target = res.body.data.conversations.find((c) => c.id === conversationA.id);
      expect(target).toBeDefined();
      expect(target.student.id).toBe(studentA.user.id);
      expect(target.student.fullName).toBe('الطالب عمر خالد');
      expect(target.group.id).toBe(groupA.id);
    });

    it('3.2 should return empty inbox for Teacher B (no conversations)', async () => {
      const res = await request(app)
        .get('/api/v1/teacher/chat/conversations')
        .set('Authorization', `Bearer ${teacherB.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversations.length).toBe(0);
    });

    it('3.3 should return conversation in Student A inbox', async () => {
      const res = await request(app)
        .get('/api/v1/students/chat/conversations')
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.conversations)).toBe(true);

      const target = res.body.data.conversations.find((c) => c.id === conversationA.id);
      expect(target).toBeDefined();
      expect(target.teacher.id).toBe(teacherA.user.id);
      expect(target.teacher.fullName).toBe('الأستاذ أحمد فوزي');
    });

    it('3.4 should fetch paginated message history in chronological order', async () => {
      const res = await request(app)
        .get(`/api/v1/chat/conversations/${conversationA.id}/messages?page=1&limit=10`)
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.totalCount).toBe(2);
      expect(res.body.data.messages.length).toBe(2);
      expect(res.body.data.messages[0].content).toBe('مرحباً يا مستر، عندي سؤال في المسألة رقم 3');
      expect(res.body.data.messages[1].content).toBe('أهلاً يا عمر، اتفضل اسأل وسأشرحها لك بالتفصيل');
      expect(res.body.data.messages[0].isMine).toBe(true);
      expect(res.body.data.messages[1].isMine).toBe(false);
    });

    it('3.5 should reject non-participant from viewing message history (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/chat/conversations/${conversationA.id}/messages`)
        .set('Authorization', `Bearer ${studentB.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Read Receipts & Counter Reset
  // =========================================================================
  describe('4. Read Receipts & Read State Management', () => {
    it('4.1 should allow student to mark conversation as read and reset unreadByStudent', async () => {
      const res = await request(app)
        .patch(`/api/v1/chat/conversations/${conversationA.id}/read`)
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversationId).toBe(conversationA.id);

      // Verify in DB that unreadByStudent is 0 and teacher's message is marked isRead: true
      const convInDb = await prisma.conversation.findUnique({ where: { id: conversationA.id } });
      expect(convInDb.unreadByStudent).toBe(0);

      const teacherMsg = await prisma.chatMessage.findFirst({
        where: { conversationId: conversationA.id, senderId: teacherA.user.id },
      });
      expect(teacherMsg.isRead).toBe(true);
    });
  });
});
