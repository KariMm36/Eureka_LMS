import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get('/', NotificationController.getNotifications);
router.get('/:id', NotificationController.getNotificationDetails);
router.patch('/:id/read', NotificationController.markAsRead);
router.patch('/read-all', NotificationController.markAllAsRead);
router.post('/fcm-token', NotificationController.registerFCMToken);

export default router;
