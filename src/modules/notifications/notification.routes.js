import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { registerFcmTokenSchema, sendGroupNotificationSchema } from './notification.validation.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);


/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get student notification feed with unread count and pagination
 *     tags: [21. Notifications & FCM Push]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [all, unread, read] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of notifications and unread count
 */
router.get('/', NotificationController.getNotifications);

/**
 * @swagger
 * /notifications/{id}:
 *   get:
 *     summary: Get notification details and automatically mark as read
 *     tags: [21. Notifications & FCM Push]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification details
 *       404:
 *         description: Notification not found
 */
router.get('/:id', NotificationController.getNotificationDetails);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [21. Notifications & FCM Push]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.patch('/:id/read', NotificationController.markAsRead);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [21. Notifications & FCM Push]
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch('/read-all', NotificationController.markAllAsRead);

/**
 * @swagger
 * /notifications/fcm-token:
 *   post:
 *     summary: Register Firebase Cloud Messaging device token for push notifications
 *     tags: [21. Notifications & FCM Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken: { type: string }
 *     responses:
 *       200:
 *         description: FCM device token saved
 */
router.post('/fcm-token', validate(registerFcmTokenSchema), NotificationController.registerFCMToken);

/**
 * @swagger
 * /notifications/group:
 *   post:
 *     summary: Send group notification (Teacher only)
 *     tags: [21. Notifications & FCM Push]
 *     responses:
 *       200:
 *         description: Group notification sent
 */
router.post('/group', authorize('TEACHER', 'ADMIN'), validate(sendGroupNotificationSchema), NotificationController.sendGroupNotification);

export default router;

