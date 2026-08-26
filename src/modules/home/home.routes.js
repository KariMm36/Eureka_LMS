import { Router } from 'express';
import { HomeController } from './home.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// Home dashboard is student-only
router.use(authenticate, authorize('STUDENT', 'ADMIN'));


/**
 * @swagger
 * /home/dashboard:
 *   get:
 *     summary: Get consolidated student home dashboard feed
 *     tags: [5. Home Dashboard]

 *     responses:
 *       200:
 *         description: Next class banner, today's schedule, homework deadlines, upcoming exams, and unread notifications
 */
router.get('/dashboard', HomeController.getHomeFeed);

export default router;
