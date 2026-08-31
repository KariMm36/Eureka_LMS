import prisma from '../config/prisma.js';
import { logger } from '../config/logger.config.js';
import { ChatService } from '../modules/chat/chat.service.js';

/**
 * Centralized Real-Time Event Handlers for Socket.IO
 * Primary Purpose: Student ↔ Teacher 1-on-1 Real-Time Chat with Strict Authorization & DB Persistence
 */
export const registerRealtimeEvents = (io, socket) => {
  /**
   * 1. Student -> Teacher Message Event
   */
  socket.on('student:send_message', async (data, callback) => {
    try {
      // 1. Guard: Only authenticated students can emit this event
      if (socket.user.role !== 'STUDENT') {
        const errorPayload = { success: false, message: 'هذا الإجراء مخصص للطلاب فقط' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      const { conversationId, groupId, content, attachmentUrl } = data || {};

      if (!content || typeof content !== 'string' || !content.trim()) {
        const errorPayload = { success: false, message: 'محتوى الرسالة مطلوب' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      let targetConversationId = conversationId;

      // If conversationId not provided but groupId is provided, find or create conversation
      if (!targetConversationId && groupId) {
        const conv = await ChatService.createOrGetConversation(socket.user.id, groupId);
        targetConversationId = conv.id;
      }

      if (!targetConversationId) {
        const errorPayload = { success: false, message: 'معرف المحادثة أو معرف المجموعة مطلوب' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      // 2. Persist message and update conversation metadata
      const result = await ChatService.sendMessage({
        senderUser: socket.user,
        conversationId: targetConversationId,
        content,
        attachmentUrl,
      });

      // 3. Persist notification in MySQL for teacher offline alert and audit
      const persistedNotification = await prisma.notification.create({
        data: {
          userId: result.recipientUserId,
          title: `سؤال جديد من الطالب: ${socket.user.fullName}`,
          body: result.message.content,
          type: 'ANNOUNCEMENT',
          referenceId: result.conversation.groupId,
        },
      });

      // 4. Emit real-time chat event to recipient teacher's room
      io.to(`user:${result.recipientUserId}`).emit('chat:new_message', result.message);

      // Also emit backward-compatible event teacher:new_message
      io.to(`user:${result.recipientUserId}`).emit('teacher:new_message', {
        id: persistedNotification.id,
        conversationId: targetConversationId,
        student: {
          id: socket.user.id,
          fullName: socket.user.fullName,
          avatarUrl: socket.user.avatarUrl,
        },
        group: {
          id: result.conversation.group.id,
          name: result.conversation.group.name,
          subjectName: result.conversation.group.subject?.nameAr || 'المادة الدراسية',
        },
        content: result.message.content,
        createdAt: persistedNotification.createdAt,
      });

      // 5. Delivery Acknowledgment
      const successPayload = {
        success: true,
        messageId: persistedNotification.id,
        chatMessageId: result.message.id,
        conversationId: targetConversationId,
        deliveredAt: result.message.createdAt,
      };

      if (typeof callback === 'function') callback(successPayload);
      socket.emit('chat:message_delivered', successPayload);
      socket.emit('student:message_delivered', successPayload);

      logger.info(
        {
          studentId: socket.user.id,
          teacherId: result.recipientUserId,
          conversationId: targetConversationId,
          messageId: result.message.id,
        },
        `[Socket.IO Chat] Real-time message delivered from student ${socket.user.id} to teacher ${result.recipientUserId}`
      );
    } catch (err) {
      logger.error({ err: err.message, userId: socket.user.id }, '[Socket.IO Error] student:send_message failed');
      const errorPayload = { success: false, message: err.message || 'حدث خطأ أثناء معالجة الرسالة' };
      if (typeof callback === 'function') callback(errorPayload);
      socket.emit('error', errorPayload);
    }
  });

  /**
   * 2. Teacher -> Student Message Event
   */
  socket.on('teacher:send_message', async (data, callback) => {
    try {
      // 1. Guard: Only authenticated teachers can emit this event
      if (socket.user.role !== 'TEACHER') {
        const errorPayload = { success: false, message: 'هذا الإجراء مخصص للمعلمين فقط' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      const { conversationId, content, attachmentUrl } = data || {};

      if (!conversationId || !content || typeof content !== 'string' || !content.trim()) {
        const errorPayload = { success: false, message: 'معرف المحادثة ومحتوى الرسالة مطلوبان' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      // 2. Persist message and update conversation metadata
      const result = await ChatService.sendMessage({
        senderUser: socket.user,
        conversationId,
        content,
        attachmentUrl,
      });

      // 3. Emit real-time chat event to recipient student's room
      io.to(`user:${result.recipientUserId}`).emit('chat:new_message', result.message);

      // 4. Delivery Acknowledgment
      const successPayload = {
        success: true,
        messageId: result.message.id,
        conversationId,
        deliveredAt: result.message.createdAt,
      };

      if (typeof callback === 'function') callback(successPayload);
      socket.emit('chat:message_delivered', successPayload);

      logger.info(
        {
          teacherId: socket.user.id,
          studentId: result.recipientUserId,
          conversationId,
          messageId: result.message.id,
        },
        `[Socket.IO Chat] Real-time message delivered from teacher ${socket.user.id} to student ${result.recipientUserId}`
      );
    } catch (err) {
      logger.error({ err: err.message, userId: socket.user.id }, '[Socket.IO Error] teacher:send_message failed');
      const errorPayload = { success: false, message: err.message || 'حدث خطأ أثناء معالجة الرسالة' };
      if (typeof callback === 'function') callback(errorPayload);
      socket.emit('error', errorPayload);
    }
  });

  /**
   * 3. Real-Time Read Receipts (Mark Conversation as Read)
   */
  socket.on('chat:message_read', async (data, callback) => {
    try {
      const { conversationId } = data || {};

      if (!conversationId) {
        const errorPayload = { success: false, message: 'معرف المحادثة مطلوب' };
        if (typeof callback === 'function') callback(errorPayload);
        return socket.emit('error', errorPayload);
      }

      const result = await ChatService.markConversationAsRead({
        user: socket.user,
        conversationId,
      });

      // Emit read receipt event to the other participant
      io.to(`user:${result.recipientUserId}`).emit('chat:messages_read', {
        conversationId,
        readBy: socket.user.id,
      });

      const successPayload = {
        success: true,
        conversationId,
        readCount: result.readCount,
      };

      if (typeof callback === 'function') callback(successPayload);
      socket.emit('chat:read_acknowledged', successPayload);
    } catch (err) {
      logger.error({ err: err.message, userId: socket.user.id }, '[Socket.IO Error] chat:message_read failed');
      const errorPayload = { success: false, message: err.message || 'حدث خطأ أثناء تحديث حالة القراءة' };
      if (typeof callback === 'function') callback(errorPayload);
      socket.emit('error', errorPayload);
    }
  });
};
