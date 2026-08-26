import { Router } from 'express';
import { HomeworkController } from './homework.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// Student homework taking/submission routes — student-only
router.use(authenticate, authorize('STUDENT', 'ADMIN'));


/**
 * @swagger
 * /homework:
 *   get:
 *     summary: Get student homework feed (filter by status pending / completed)
 *     tags: [6. Homework Engine]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, completed] }
 *     responses:
 *       200:
 *         description: List of homework assignments
 */
router.get('/', HomeworkController.getHomeworkFeed);

/**
 * @swagger
 * /homework/{homeworkId}:
 *   get:
 *     summary: Get homework questions for taking (Hides correct answers and explanations)
 *     tags: [6. Homework Engine]
 *     parameters:
 *       - in: path
 *         name: homeworkId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sanitized homework questions
 *       404:
 *         description: Homework not found
 */
router.get('/:homeworkId', HomeworkController.getHomeworkForTaking);

/**
 * @swagger
 * /homework/{homeworkId}/submit:
 *   post:
 *     summary: Submit homework answers (Auto-grades MCQs, validates essay minWords, computes peer percentile)
 *     tags: [6. Homework Engine]
 *     parameters:
 *       - in: path
 *         name: homeworkId
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
 *                     timeSpentSeconds: { type: number }
 *     responses:
 *       200:
 *         description: Homework submitted and graded
 *       400:
 *         description: Essay word count below minWords
 *       409:
 *         description: Already submitted
 */
router.post('/:homeworkId/submit', HomeworkController.submitHomework);

/**
 * @swagger
 * /homework/{homeworkId}/result:
 *   get:
 *     summary: Get detailed homework result scorecard and reviewed answers
 *     tags: [6. Homework Engine]
 *     parameters:
 *       - in: path
 *         name: homeworkId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Homework result scorecard
 */
router.get('/:homeworkId/result', HomeworkController.getHomeworkResult);

export default router;
