import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

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
}
