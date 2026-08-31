import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export class ChatService {
  /**
   * 1. Create or Find existing 1-on-1 Conversation (Student -> Group Teacher)
   */
  static async createOrGetConversation(studentUserId, groupId) {
    // 1. Verify student profile
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    // 2. Verify active enrollment in group
    const enrollment = await prisma.groupEnrollment.findFirst({
      where: {
        groupId,
        studentId: studentProfile.id,
        status: 'ACTIVE',
      },
      include: {
        group: {
          include: {
            teacher: {
              select: { id: true, fullName: true, avatarUrl: true, email: true },
            },
            subject: {
              select: { id: true, nameAr: true, nameEn: true },
            },
          },
        },
      },
    });

    if (!enrollment || !enrollment.group || !enrollment.group.teacher) {
      throw ApiError.forbidden('غير مصرح لك بإرسال رسائل - لست مسجلاً كطالب نشط في هذه المجموعة');
    }

    const teacherId = enrollment.group.teacherId;

    // 3. Find existing or create new conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        groupId_studentId_teacherId: {
          groupId,
          studentId: studentUserId,
          teacherId,
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            subject: { select: { id: true, nameAr: true } },
          },
        },
        teacher: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        student: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          groupId,
          studentId: studentUserId,
          teacherId,
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              subject: { select: { id: true, nameAr: true } },
            },
          },
          teacher: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          student: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      });
    }

    return {
      id: conversation.id,
      groupId: conversation.groupId,
      groupName: conversation.group.name,
      subjectName: conversation.group.subject?.nameAr || 'المادة الدراسية',
      teacher: {
        id: conversation.teacher.id,
        fullName: conversation.teacher.fullName,
        avatarUrl: conversation.teacher.avatarUrl,
      },
      student: {
        id: conversation.student.id,
        fullName: conversation.student.fullName,
        avatarUrl: conversation.student.avatarUrl,
      },
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: conversation.unreadByStudent,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * 2. Get Teacher Inbox Conversations
   */
  static async getTeacherConversations(teacherUserId, query = {}) {
    const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      teacherId: teacherUserId,
      ...(query.groupId && { groupId: query.groupId }),
      ...(query.search && {
        student: {
          fullName: { contains: query.search },
        },
      }),
    };

    const [totalCount, conversations] = await prisma.$transaction([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              subject: { select: { id: true, nameAr: true } },
            },
          },
          student: {
            select: { id: true, fullName: true, avatarUrl: true, phone: true },
          },
        },
      }),
    ]);

    return {
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNum * pageSize < totalCount,
      },
      conversations: conversations.map((c) => ({
        id: c.id,
        group: {
          id: c.group.id,
          name: c.group.name,
          subjectName: c.group.subject?.nameAr || 'المادة الدراسية',
        },
        student: {
          id: c.student.id,
          fullName: c.student.fullName,
          avatarUrl: c.student.avatarUrl,
          phone: c.student.phone,
        },
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadByTeacher,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  /**
   * 3. Get Student Inbox Conversations
   */
  static async getStudentConversations(studentUserId, query = {}) {
    const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      studentId: studentUserId,
      ...(query.groupId && { groupId: query.groupId }),
    };

    const [totalCount, conversations] = await prisma.$transaction([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              subject: { select: { id: true, nameAr: true } },
            },
          },
          teacher: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      }),
    ]);

    return {
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNum * pageSize < totalCount,
      },
      conversations: conversations.map((c) => ({
        id: c.id,
        group: {
          id: c.group.id,
          name: c.group.name,
          subjectName: c.group.subject?.nameAr || 'المادة الدراسية',
        },
        teacher: {
          id: c.teacher.id,
          fullName: c.teacher.fullName,
          avatarUrl: c.teacher.avatarUrl,
        },
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadByStudent,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  /**
   * 4. Get Messages for a specific Conversation (Paginated)
   */
  static async getConversationMessages(user, conversationId, query = {}) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        group: { select: { id: true, name: true, teacherId: true } },
      },
    });

    if (!conversation) {
      throw ApiError.notFound('المحادثة غير موجودة');
    }

    // Authorization checks
    if (user.role === 'TEACHER') {
      if (conversation.teacherId !== user.id) {
        throw ApiError.forbidden('غير مصرح لك بالوصول إلى هذه المحادثة');
      }
    } else if (user.role === 'STUDENT') {
      if (conversation.studentId !== user.id) {
        throw ApiError.forbidden('غير مصرح لك بالوصول إلى هذه المحادثة');
      }

      // Verify active enrollment
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: user.id },
      });

      if (!studentProfile) {
        throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
      }

      const enrollment = await prisma.groupEnrollment.findFirst({
        where: {
          groupId: conversation.groupId,
          studentId: studentProfile.id,
          status: 'ACTIVE',
        },
      });

      if (!enrollment) {
        throw ApiError.forbidden('غير مصرح لك بالوصول إلى هذه المحادثة - حالة عضويتك في المجموعة غير نشطة');
      }
    } else if (user.role !== 'ADMIN') {
      throw ApiError.forbidden('غير مصرح لك بالوصول إلى هذه المحادثة');
    }

    const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 30));
    const skip = (pageNum - 1) * pageSize;

    const where = { conversationId };

    const [totalCount, rawMessages] = await prisma.$transaction([
      prisma.chatMessage.count({ where }),
      prisma.chatMessage.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, fullName: true, avatarUrl: true, role: true },
          },
        },
      }),
    ]);

    // Return in chronological order (oldest to newest) for UI ease
    const messages = rawMessages.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      sender: {
        id: m.sender.id,
        fullName: m.sender.fullName,
        avatarUrl: m.sender.avatarUrl,
        role: m.sender.role,
      },
      isMine: m.senderId === user.id,
      content: m.content,
      attachmentUrl: m.attachmentUrl,
      isRead: m.isRead,
      createdAt: m.createdAt,
    }));

    return {
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNum * pageSize < totalCount,
      },
      messages,
    };
  }

  /**
   * 5. Send Message (HTTP or Socket.IO backend logic)
   */
  static async sendMessage({ senderUser, conversationId, content, attachmentUrl = null }) {
    if (!content || !content.trim()) {
      throw ApiError.badRequest('محتوى الرسالة مطلوب');
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        group: {
          include: {
            subject: { select: { id: true, nameAr: true } },
          },
        },
        student: { select: { id: true, fullName: true, avatarUrl: true } },
        teacher: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    if (!conversation) {
      throw ApiError.notFound('المحادثة غير موجودة');
    }

    let recipientUserId;

    // Authorization & recipient determination
    if (senderUser.role === 'STUDENT') {
      if (conversation.studentId !== senderUser.id) {
        throw ApiError.forbidden('غير مصرح لك بإرسال رسائل في هذه المحادثة');
      }

      // Check active enrollment
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: senderUser.id },
      });

      if (!studentProfile) {
        throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
      }

      const enrollment = await prisma.groupEnrollment.findFirst({
        where: {
          groupId: conversation.groupId,
          studentId: studentProfile.id,
          status: 'ACTIVE',
        },
      });

      if (!enrollment) {
        throw ApiError.forbidden('غير مصرح لك بإرسال رسائل - حالة عضويتك في المجموعة غير نشطة');
      }

      recipientUserId = conversation.teacherId;
    } else if (senderUser.role === 'TEACHER') {
      if (conversation.teacherId !== senderUser.id) {
        throw ApiError.forbidden('غير مصرح لك بإرسال رسائل في هذه المحادثة');
      }
      recipientUserId = conversation.studentId;
    } else {
      throw ApiError.forbidden('غير مصرح لك بإرسال رسائل في هذه المحادثة');
    }

    const cleanContent = content.trim();
    const now = new Date();

    // Persist message + update conversation metadata in atomic transaction
    const [message, updatedConversation] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId,
          senderId: senderUser.id,
          senderRole: senderUser.role,
          content: cleanContent,
          attachmentUrl: attachmentUrl || null,
          isRead: false,
        },
        include: {
          sender: {
            select: { id: true, fullName: true, avatarUrl: true, role: true },
          },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: cleanContent,
          lastMessageAt: now,
          ...(senderUser.role === 'STUDENT'
            ? { unreadByTeacher: { increment: 1 } }
            : { unreadByStudent: { increment: 1 } }),
        },
      }),
    ]);

    const formattedMessage = {
      id: message.id,
      conversationId: message.conversationId,
      sender: {
        id: message.sender.id,
        fullName: message.sender.fullName,
        avatarUrl: message.sender.avatarUrl,
        role: message.sender.role,
      },
      content: message.content,
      attachmentUrl: message.attachmentUrl,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };

    return {
      message: formattedMessage,
      recipientUserId,
      conversation: {
        ...updatedConversation,
        group: conversation.group,
      },
    };
  }

  /**
   * 6. Mark Conversation Messages as Read
   */
  static async markConversationAsRead({ user, conversationId }) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw ApiError.notFound('المحادثة غير موجودة');
    }

    if (conversation.studentId !== user.id && conversation.teacherId !== user.id && user.role !== 'ADMIN') {
      throw ApiError.forbidden('غير مصرح لك بالوصول إلى هذه المحادثة');
    }

    const isStudent = user.role === 'STUDENT' || conversation.studentId === user.id;
    const otherParticipantUserId = isStudent ? conversation.teacherId : conversation.studentId;

    // 1. Mark unread messages sent by the other participant as read
    const updateResult = await prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    // 2. Reset user's unread counter on conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: isStudent ? { unreadByStudent: 0 } : { unreadByTeacher: 0 },
    });

    return {
      success: true,
      conversationId,
      readCount: updateResult.count,
      recipientUserId: otherParticipantUserId,
    };
  }
}
