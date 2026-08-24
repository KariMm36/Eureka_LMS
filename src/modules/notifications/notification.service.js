import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { sendPushNotificationToTokens, sendPushNotification } from '../../utils/pushNotification.util.js';

export class NotificationService {
  /**
   * 1. Get notifications list with filters (all / read / unread)
   * Matches Screen 4 in UI
   */
  static async getNotifications(userId, filter = 'all', search = '') {
    const where = {
      userId,
      ...(filter === 'read' && { isRead: true }),
      ...(filter === 'unread' && { isRead: false }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { body: { contains: search } },
        ],
      }),
    };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        referenceId: n.referenceId,
        attachments: n.attachments ? JSON.parse(n.attachments) : [],
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    };
  }

  /**
   * 2. Get Notification Details
   * Matches Screen 4 (notification Details)
   */
  static async getNotificationDetails(userId, notificationId) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw ApiError.notFound('الإشعار غير موجود');
    }

    // Auto mark as read
    if (!notification.isRead) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true },
      });
    }

    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      referenceId: notification.referenceId,
      attachments: notification.attachments ? JSON.parse(notification.attachments) : [],
      isRead: true,
      createdAt: notification.createdAt,
    };
  }

  /**
   * 3. Mark single notification as read
   */
  static async markAsRead(userId, notificationId) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw ApiError.notFound('الإشعار غير موجود');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * 4. Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'تم تحديد جميع الإشعارات كمقروءة' };
  }

  /**
   * 5. Register Mobile Firebase FCM Token
   */
  static async registerFCMToken(userId, fcmToken) {
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });

    return { message: 'تم تحديث رمز الإشعارات بنجاح' };
  }

  /**
   * 6. Broadcast notification to all active students in a group (In-App + FCM Push)
   */
  static async notifyGroupStudents({ groupId, title, body, type, referenceId }) {
    const enrollments = await prisma.groupEnrollment.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        student: {
          include: {
            user: { select: { id: true, fcmToken: true, notifyHomework: true, notifyAnnouncements: true } },
          },
        },
      },
    });

    if (!enrollments.length) return;

    const userIds = [];
    const fcmTokens = [];

    for (const enrollment of enrollments) {
      const user = enrollment.student?.user;
      if (!user) continue;

      // Check notification preferences
      if (type === 'HOMEWORK' && !user.notifyHomework) continue;

      userIds.push(user.id);
      if (user.fcmToken) {
        fcmTokens.push(user.fcmToken);
      }
    }

    // 1. Batch Create In-App Notifications
    if (userIds.length > 0) {
      await prisma.notification.createMany({
        data: userIds.map((uid) => ({
          userId: uid,
          title,
          body,
          type,
          referenceId,
        })),
      });
    }

    // 2. Dispatch FCM Push Notifications to All Enrolled Devices
    if (fcmTokens.length > 0) {
      sendPushNotificationToTokens({
        tokens: fcmTokens,
        title,
        body,
        data: { type, referenceId },
      }).catch((err) => console.error('[Push Multicast] Failed sending group notification:', err.message));
    }
  }

  /**
   * 7. Trigger notification for a New Homework Assignment
   */
  static async notifyNewHomework(homeworkId) {
    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        group: { include: { subject: true } },
      },
    });

    if (!homework || !homework.groupId) return;

    const subjectName = homework.group?.subject?.nameAr || 'المادة';
    const dueDateStr = new Date(homework.dueDate).toLocaleDateString('ar-EG', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    await this.notifyGroupStudents({
      groupId: homework.groupId,
      title: `📚 واجب جديد: ${homework.title}`,
      body: `تمت إضافة واجب جديد في مادة ${subjectName}. آخر موعد للتسليم هو ${dueDateStr}.`,
      type: 'HOMEWORK',
      referenceId: homework.id,
    });
  }

  /**
   * 8. Trigger notification for a New Exam / Quiz
   */
  static async notifyNewExam(examId) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        group: { include: { subject: true } },
      },
    });

    if (!exam || !exam.groupId) return;

    const subjectName = exam.group?.subject?.nameAr || 'المادة';
    const startDateStr = new Date(exam.startTime).toLocaleString('ar-EG', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    await this.notifyGroupStudents({
      groupId: exam.groupId,
      title: `⏱️ كويز / امتحان جديد: ${exam.title}`,
      body: `تم تحديد موعد امتحان جديد في مادة ${subjectName}. يبدأ في ${startDateStr} لمدة ${exam.durationMinutes} دقيقة.`,
      type: 'EXAM',
      referenceId: exam.id,
    });
  }

  /**
   * 9. Trigger notification when teacher grades an essay question
   */
  static async notifyEssayGraded({ userId, title, submissionType, referenceId, scoreObtained, totalScore }) {
    const notifTitle = '✍️ تم تصحيح إجابتك المقالية';
    const notifBody = `قام المعلم بتصحيح إجابتك في ${submissionType === 'HOMEWORK' ? 'واجب' : 'امتحان'} "${title}". درجتك النهائية الآن: ${scoreObtained}/${totalScore} 🎉`;

    await prisma.notification.create({
      data: {
        userId,
        title: notifTitle,
        body: notifBody,
        type: submissionType === 'HOMEWORK' ? 'HOMEWORK' : 'EXAM',
        referenceId,
      },
    });

    sendPushNotification({
      userId,
      title: notifTitle,
      body: notifBody,
      data: { type: submissionType, referenceId },
    }).catch((err) => console.error('[Push Notification] Error sending essay graded push:', err.message));
  }
}

