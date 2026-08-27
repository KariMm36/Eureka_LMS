import prisma from '../config/prisma.js';
import { logger } from '../config/logger.config.js';

/**
 * Centralized Real-Time Event Handlers for Socket.IO
 * Primary Purpose: Student -> Teacher Communication with strict Server-Side Authorization
 */
export const registerRealtimeEvents = (io, socket) => {
  /**
   * Student -> Teacher Inquiry / Message Event
   * Strict Authorization: Server determines teacher from active group enrollment in DB.
   */
  socket.on('student:send_message', async (data, callback) => {
    try {
      // 1. Guard: Only authenticated students can emit this event
      if (socket.user.role !== 'STUDENT') {
        const errorPayload = { success: false, message: 'هذا الإجراء مخصص للطلاب فقط' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      const { groupId, content } = data || {};

      // 2. Validate input payload
      if (!groupId || !content || typeof content !== 'string' || !content.trim()) {
        const errorPayload = { success: false, message: 'محتوى الرسالة ومعرف المجموعة مطلوبان' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      const cleanContent = content.trim();

      // 3. Database Authorization: Verify active student enrollment and resolve teacher
      const enrollment = await prisma.groupEnrollment.findFirst({
        where: {
          groupId,
          student: { userId: socket.user.id },
          status: 'ACTIVE',
        },
        include: {
          group: {
            include: {
              teacher: {
                select: { id: true, fullName: true, email: true },
              },
              subject: { select: { id: true, nameAr: true } },
            },
          },
          student: {
            include: {
              user: {
                select: { id: true, fullName: true, avatarUrl: true },
              },
            },
          },
        },
      });

      // Reject unauthorized communication attempt (student not actively enrolled in this group)
      if (!enrollment || !enrollment.group || !enrollment.group.teacher) {
        const errorPayload = { success: false, message: 'غير مصرح لك بإرسال رسائل - لست مسجلاً كطالب نشط في هذه المجموعة' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      // 4. Server-Resolved Target Teacher ID (Client cannot tamper with this)
      const targetTeacherUserId = enrollment.group.teacher.id;

      // 5. Message Persistence: Save notification/message to MySQL before real-time emission
      const persistedRecord = await prisma.notification.create({
        data: {
          userId: targetTeacherUserId,
          title: `سؤال جديد من الطالب: ${enrollment.student.user.fullName}`,
          body: cleanContent,
          type: 'ANNOUNCEMENT',
          referenceId: groupId,
        },
      });

      // 6. Real-Time Emission: Emit ONLY to the authorized teacher's personal room
      io.to(`user:${targetTeacherUserId}`).emit('teacher:new_message', {
        id: persistedRecord.id,
        student: {
          id: enrollment.student.user.id,
          fullName: enrollment.student.user.fullName,
          avatarUrl: enrollment.student.user.avatarUrl,
        },
        group: {
          id: enrollment.group.id,
          name: enrollment.group.name,
          subjectName: enrollment.group.subject?.nameAr || 'المادة الدراسية',
        },
        content: cleanContent,
        createdAt: persistedRecord.createdAt,
      });

      // 7. Acknowledge delivery to the student socket
      const successPayload = {
        success: true,
        messageId: persistedRecord.id,
        teacherName: enrollment.group.teacher.fullName,
        deliveredAt: persistedRecord.createdAt,
      };

      if (typeof callback === 'function') {
        callback(successPayload);
      }
      socket.emit('student:message_delivered', successPayload);

      logger.info({
        studentId: socket.user.id,
        teacherId: targetTeacherUserId,
        groupId,
        messageId: persistedRecord.id,
      }, `[Socket.IO] Real-time message delivered from student ${socket.user.id} to teacher ${targetTeacherUserId}`);
    } catch (err) {
      logger.error({ err: err.message, userId: socket.user.id }, '[Socket.IO Error] student:send_message failed');
      const errorPayload = { success: false, message: 'حدث خطأ أثناء معالجة الرسالة' };
      if (typeof callback === 'function') callback(errorPayload);
      socket.emit('error', errorPayload);
    }
  });
};
