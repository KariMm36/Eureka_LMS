import { ChatService } from './chat.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { getIO } from '../../config/socket.config.js';

export class ChatController {
  /**
   * 1. Create or Get Conversation (Student -> Group Teacher)
   */
  static async createOrGetConversation(req, res, next) {
    try {
      const data = await ChatService.createOrGetConversation(req.user.id, req.body.groupId);
      return ApiResponse.success(res, data, 'تم بدء / استرجاع المحادثة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 2. Get User Inbox Conversations (Auto-detects Teacher or Student from JWT)
   */
  static async getUserConversations(req, res, next) {
    try {
      let data;
      if (req.user.role === 'TEACHER' || req.user.role === 'ADMIN') {
        data = await ChatService.getTeacherConversations(req.user.id, req.query);
      } else {
        data = await ChatService.getStudentConversations(req.user.id, req.query);
      }
      return ApiResponse.success(res, data, 'تم جلب قائمة المحادثات بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 3. Get Teacher Inbox Conversations
   */
  static async getTeacherConversations(req, res, next) {
    try {
      const data = await ChatService.getTeacherConversations(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب محادثات المعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 4. Get Student Inbox Conversations
   */
  static async getStudentConversations(req, res, next) {
    try {
      const data = await ChatService.getStudentConversations(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب محادثات الطالب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 4. Get Conversation Messages History (Paginated)
   */
  static async getConversationMessages(req, res, next) {
    try {
      const data = await ChatService.getConversationMessages(
        req.user,
        req.params.conversationId,
        req.query
      );
      return ApiResponse.success(res, data, 'تم جلب سجل رسائل المحادثة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 5. Send Message (HTTP Fallback)
   */
  static async sendMessage(req, res, next) {
    try {
      const result = await ChatService.sendMessage({
        senderUser: req.user,
        conversationId: req.params.conversationId,
        content: req.body.content || req.body.message,
        attachmentUrl: req.body.attachmentUrl,
      });

      // Real-time notification over Socket.IO to recipient's private room
      try {
        const io = getIO();
        io.to(`user:${result.recipientUserId}`).emit('chat:new_message', result.message);
      } catch (_) {
        // Socket.IO may not be running in isolated test environments
      }

      return ApiResponse.created(res, result.message, 'تم إرسال الرسالة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 6. Mark Conversation Messages as Read
   */
  static async markConversationAsRead(req, res, next) {
    try {
      const result = await ChatService.markConversationAsRead({
        user: req.user,
        conversationId: req.params.conversationId,
      });

      // Real-time read receipt over Socket.IO to other participant
      try {
        const io = getIO();
        io.to(`user:${result.recipientUserId}`).emit('chat:messages_read', {
          conversationId: req.params.conversationId,
          readBy: req.user.id,
        });
      } catch (_) {}

      return ApiResponse.success(res, result, 'تم تحديث حالة قراءة الرسائل بنجاح');
    } catch (error) {
      next(error);
    }
  }
}
