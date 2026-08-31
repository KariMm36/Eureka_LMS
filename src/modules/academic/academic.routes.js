import { Router } from 'express';
import { AcademicController } from './academic.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Academic catalogue routes require authentication
router.use(authenticate);


/**
 * @swagger
 * /academic/stages:
 *   get:
 *     summary: Get all academic stages with their grade levels (In-memory cached)
 *     tags: [03. Student - Academic Catalogue]
 *     responses:
 *       200:
 *         description: List of educational stages
 */
router.get('/stages', AcademicController.getStages);

/**
 * @swagger
 * /academic/subjects:
 *   get:
 *     summary: Get all subjects or filter by stageId / gradeLevelId
 *     tags: [03. Student - Academic Catalogue]
 *     parameters:
 *       - in: query
 *         name: stageId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: gradeLevelId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of subjects
 */
router.get('/subjects', AcademicController.getSubjects);

/**
 * @swagger
 * /academic/subjects/{subjectId}/units:
 *   get:
 *     summary: Get syllabus units and lessons for a specific subject
 *     tags: [03. Student - Academic Catalogue]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: gradeLevelId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unit hierarchy and lesson list
 */
router.get('/subjects/:subjectId/units', AcademicController.getSubjectUnits);

/**
 * @swagger
 * /academic/lessons/{lessonId}:
 *   get:
 *     summary: Get detailed lesson content, video URLs, and study attachments
 *     tags: [03. Student - Academic Catalogue]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lesson details
 *       404:
 *         description: Lesson not found
 */
router.get('/lessons/:lessonId', AcademicController.getLessonDetails);

export default router;
