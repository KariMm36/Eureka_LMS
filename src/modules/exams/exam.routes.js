import { Router } from 'express';
import { ExamController } from './exam.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All exam routes require student authentication
router.use(authenticate);

router.get('/', ExamController.getExamsFeed);
router.get('/:examId/instructions', ExamController.getExamInstructions);
router.post('/:examId/start', ExamController.startExam);
router.post('/:examId/submit', ExamController.submitExam);
router.get('/:examId/result', ExamController.getExamResult);

export default router;
