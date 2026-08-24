import { Router } from 'express';
import { HomeController } from './home.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Home routes require authentication
router.use(authenticate);


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
