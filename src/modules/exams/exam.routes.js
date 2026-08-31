import { Router } from 'express';
import { ExamController } from './exam.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { submitExamSchema } from './exam.validation.js';

const router = Router();

// Student exam taking/submission routes — student-only
router.use(authenticate, authorize('STUDENT', 'ADMIN'));


/**
 * @swagger
 * /exams:
 *   get:
 *     summary: Get student exams feed with status badges (available / upcoming / completed)
 *     tags: [07. Student - Exams & Timed Quizzes]
 *     parameters:
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [all, available, upcoming, completed] }
 *     responses:
 *       200:
 *         description: List of exams
 */
router.get('/', ExamController.getExamsFeed);

/**
 * @swagger
 * /exams/{examId}/instructions:
 *   get:
 *     summary: Get exam guidelines, duration, passing percentage, and 4-color palette legend
 *     tags: [07. Student - Exams & Timed Quizzes]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Exam instructions and palette guide
 */
router.get('/:examId/instructions', ExamController.getExamInstructions);

/**
 * @swagger
 * /exams/{examId}/start:
 *   post:
 *     summary: Start live exam session (Enforces server-time window before/after, returns sanitized questions)
 *     tags: [07. Student - Exams & Timed Quizzes]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Exam session started, questions returned
 *       400:
 *         description: Exam not started yet or time window expired
 *       409:
 *         description: Exam already completed
 */
router.post('/:examId/start', ExamController.startExam);

/**
 * @swagger
 * /exams/{examId}/submit:
 *   post:
 *     summary: Submit live exam answers (Auto-grades MCQs, validates essay minWords, records palette analytics)
 *     tags: [07. Student - Exams & Timed Quizzes]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId: { type: string, format: uuid }
 *                     selectedOption: { type: integer }
 *                     essayText: { type: string }
 *                     paletteStatus: { type: string, enum: [ANSWERED, REVIEW, UNANSWERED, NOT_VISITED] }
 *                     timeSpentSeconds: { type: number }
 *     responses:
 *       200:
 *         description: Exam submitted successfully
 *       400:
 *         description: Essay word count below minimum
 *       409:
 *         description: Exam already submitted
 */
router.post('/:examId/submit', validate(submitExamSchema), ExamController.submitExam);

/**
 * @swagger
 * /exams/{examId}/result:
 *   get:
 *     summary: Get comprehensive exam report card, pass/fail status, and question review
 *     tags: [07. Student - Exams & Timed Quizzes]
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Exam report card
 */
router.get('/:examId/result', ExamController.getExamResult);

export default router;
