import prisma from '../../../config/prisma.js';
import { AdminAuditService } from './admin-audit.service.js';
import { getIO } from '../../../config/socket.config.js';
import { sendPushNotificationToTokens } from '../../../utils/pushNotification.util.js';
import { logger } from '../../../config/logger.config.js';

export class AdminNotificationService {
  /**
   * Send System-Wide Platform Broadcast (In-App + Socket.IO + FCM Push)
   */
  static async sendPlatformBroadcast(adminId, { targetAudience = 'ALL', title, message, type = 'ANNOUNCEMENT' }) {
    const where = {
      isActive: true,
      ...(targetAudience === 'STUDENTS' && { role: 'STUDENT' }),
      ...(targetAudience === 'TEACHERS' && { role: 'TEACHER' }),
    };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fcmToken: true,
      },
    });

    if (users.length === 0) {
      return { recipientCount: 0, message: 'لا يوجد مستخدمين مستهدفين لهذا الإشعار' };
    }

    const userIds = users.map((u) => u.id);
    const fcmTokens = users.filter((u) => u.fcmToken).map((u) => u.fcmToken);

    // 1. Batch Create In-App Notifications in MySQL
    await prisma.notification.createMany({
      data: userIds.map((uid) => ({
        userId: uid,
        title,
        body: message,
        type,
      })),
    });

    // 2. Real-Time Socket.IO emission to personal rooms
    try {
      const io = getIO();
      const now = new Date();
      for (const uid of userIds) {
        io.to(`user:${uid}`).emit('notification:new', {
          title,
          body: message,
          type,
          createdAt: now,
        });
      }
    } catch (_) {}

    // 3. Resilient Multicast FCM Push
    if (fcmTokens.length > 0) {
      sendPushNotificationToTokens({
        tokens: fcmTokens,
        title,
        body: message,
        data: { type },
      }).catch((err) => logger.warn({ err: err.message }, '[Admin Broadcast FCM Error]'));
    }

    // 4. Record Audit Log
    await AdminAuditService.logAction({
      adminId,
      action: 'BROADCAST_SENT',
      resource: 'NOTIFICATION',
      metadata: {
        targetAudience,
        recipientCount: userIds.length,
        title,
      },
    });

    return {
      recipientCount: userIds.length,
      targetAudience,
      title,
    };
  }
}
