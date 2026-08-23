import { Router } from 'express';
import { HomeworkController } from './homework.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All homework routes require student authentication
router.use(authenticate);

router.get('/', HomeworkController.getHomeworkFeed);
router.get('/:homeworkId', HomeworkController.getHomeworkForTaking);
router.post('/:homeworkId/submit', HomeworkController.submitHomework);
router.get('/:homeworkId/result', HomeworkController.getHomeworkResult);

export default router;
