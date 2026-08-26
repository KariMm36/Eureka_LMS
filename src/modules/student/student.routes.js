import { Router } from 'express';
import { StudentController } from './student.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { upload } from '../../config/multer.config.js';
import {
  onboardingSchema,
  updateProfileSchema,
  updateSubjectsSchema,
  updateSettingsSchema,
} from './student.validation.js';

const router = Router();

// All student routes require JWT authentication & Student role
router.use(authenticate, authorize('STUDENT', 'ADMIN'));

/**
 * @swagger
 * /students/onboarding:
 *   post:
 *     summary: Complete student onboarding (Select stage, grade level, subjects)
 *     tags: [3. Student Onboarding & Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stageId, gradeLevelId, subjectIds]
 *             properties:
 *               stageId: { type: string, format: uuid }
 *               gradeLevelId: { type: string, format: uuid }
 *               subjectIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 */
router.post('/onboarding', validate(onboardingSchema), StudentController.completeOnboarding);

/**
 * @swagger
 * /students/profile:
 *   get:
 *     summary: Get complete student profile
 *     tags: [3. Student Onboarding & Profile]
 *     responses:
 *       200:
 *         description: Student profile details with enrolled groups and subjects
 */
router.get('/profile', StudentController.getProfile);

/**
 * @swagger
 * /students/profile:
 *   put:
 *     summary: Update profile info and avatar
 *     tags: [3. Student Onboarding & Profile]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string }
 *               parentPhone: { type: string }
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', upload.single('avatar'), validate(updateProfileSchema), StudentController.updateProfile);

/**
 * @swagger
 * /students/subjects:
 *   put:
 *     summary: Update student selected subjects
 *     tags: [3. Student Onboarding & Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subjectIds]
 *             properties:
 *               subjectIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Selected subjects updated
 */
router.put('/subjects', validate(updateSubjectsSchema), StudentController.updateSubjects);

/**
 * @swagger
 * /students/settings:
 *   put:
 *     summary: Update app settings (Language, Dark Mode, Notification Preferences)
 *     tags: [3. Student Onboarding & Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appLanguage: { type: string, enum: [AR, EN] }
 *               darkMode: { type: boolean }
 *               notifyExams: { type: boolean }
 *               notifyHomework: { type: boolean }
 *               notifyMessages: { type: boolean }
 *     responses:
 *       200:
 *         description: Settings saved
 */
router.put('/settings', validate(updateSettingsSchema), StudentController.updateSettings);

/**
 * @swagger
 * /students/analytics:
 *   get:
 *     summary: Get student performance analytics, completion rates, and dynamic peer ranking badge
 *     tags: [9. Student Analytics]
 *     responses:
 *       200:
 *         description: Aggregated homework and exam statistics
 */
router.get('/analytics', StudentController.getAnalytics);

/**
 * @swagger
 * /students/attendance/record:
 *   post:
 *     summary: Record student attendance by scanning live QR code or entering 6-digit session PIN
 *     tags: [3. Student Onboarding & Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qrToken: { type: string, example: "a3f89e21b7c..." }
 *               sessionCode: { type: string, example: "784291" }
 *     responses:
 *       200:
 *         description: Attendance recorded successfully
 *       400:
 *         description: QR or Code expired
 *       403:
 *         description: Student not enrolled in group
 *       404:
 *         description: Session not found
 */
router.post('/attendance/record', StudentController.recordAttendance);

export default router;

