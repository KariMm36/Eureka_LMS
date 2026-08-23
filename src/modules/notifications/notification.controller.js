import { NotificationService } from './notification.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class NotificationController {
  static async getNotifications(req, res, next) {
    try {
      const { filter, search } = req.query;
      const result = await NotificationService.getNotifications(req.user.id, filter, search);
      return ApiResponse.success(res, result, 'قائمة الإشعارات');
    } catch (error) {
      next(error);
    }
  }

  static async getNotificationDetails(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.getNotificationDetails(req.user.id, id);
      return ApiResponse.success(res, notification, 'تفاصيل الإشعار');
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      await NotificationService.markAsRead(req.user.id, id);
      return ApiResponse.success(res, null, 'تم تحديد الإشعار كمقروء');
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req, res, next) {
    try {
      const result = await NotificationService.markAllAsRead(req.user.id);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async registerFCMToken(req, res, next) {
    try {
      const { fcmToken } = req.body;
      const result = await NotificationService.registerFCMToken(req.user.id, fcmToken);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
