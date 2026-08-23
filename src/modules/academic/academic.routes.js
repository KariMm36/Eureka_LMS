import { Router } from 'express';
import { AcademicController } from './academic.controller.js';

const router = Router();

// Academic Catalogue Endpoints
router.get('/stages', AcademicController.getStages);
router.get('/subjects', AcademicController.getSubjects);
router.get('/subjects/:subjectId/topics', AcademicController.getSubjectUnits);
router.get('/lessons/:lessonId', AcademicController.getLessonDetails);

export default router;
