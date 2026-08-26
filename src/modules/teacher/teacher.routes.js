import { Router } from 'express';
import { TeacherController } from './teacher.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadImage, uploadDocument, uploadVideo } from '../../config/multer.config.js';
import {
  createGroupSchema,
  updateGroupSchema,
  addStudentToGroupSchema,
  updateStudentSchema,
  updateTeacherProfileSchema,
  updateTeacherSettingsSchema,
  createSessionSchema,
  manualAttendanceSchema,
  createSubjectSchema,
  createUnitSchema,
  updateUnitSchema,
  createLessonSchema,
  updateLessonSchema,
  uploadVideoSchema,
  uploadMaterialSchema,
} from './teacher.validation.js';

const router = Router();

// All teacher routes require authentication & TEACHER / ADMIN role
router.use(authenticate, authorize('TEACHER', 'ADMIN'));

// ----------------------------------------------------
// 10. Teacher Dashboard
// ----------------------------------------------------

/**
 * @swagger
 * /teacher/dashboard:
 *   get:
 *     summary: Get teacher consolidated dashboard KPIs, today schedule, and active exams
 *     tags: [10. Teacher Dashboard]
 *     responses:
 *       200:
 *         description: Teacher dashboard data
 */
router.get('/dashboard', TeacherController.getDashboard);

// ----------------------------------------------------
// 11. Teacher Groups & Student Roster
// ----------------------------------------------------

/**
 * @swagger
 * /teacher/groups:
 *   get:
 *     summary: List teacher groups with active student counts and schedules
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: stageId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: gradeLevelId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated teacher groups
 */
router.get('/groups', TeacherController.getGroups);

/**
 * @swagger
 * /teacher/groups:
 *   post:
 *     summary: Create a new study group with schedule, capacity, default price, and cover image
 *     tags: [11. Teacher Groups & Student Roster]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, subjectId, stageId, gradeLevelId, scheduleDays]
 *             properties:
 *               name: { type: string, example: "الصف السادس - مجموعة أ" }
 *               subjectId: { type: string, format: uuid }
 *               stageId: { type: string, format: uuid }
 *               gradeLevelId: { type: string, format: uuid }
 *               groupCode: { type: string, example: "PHY-10-A" }
 *               scheduleDays: { type: string, example: "الأحد,الثلاثاء" }
 *               scheduleTime: { type: string, example: "05:00 PM" }
 *               maxCapacity: { type: integer, example: 50 }
 *               defaultPrice: { type: number, example: 300 }
 *               description: { type: string, example: "مجموعة الشرح والتدريبات" }
 *               cover: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Group created successfully
 */
router.post('/groups', uploadImage.single('cover'), validate(createGroupSchema), TeacherController.createGroup);

/**
 * @swagger
 * /teacher/groups/{groupId}:
 *   get:
 *     summary: Get detailed group information and counts
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Group details
 *       404:
 *         description: Group not found or unauthorized
 */
router.get('/groups/:groupId', TeacherController.getGroupById);

/**
 * @swagger
 * /teacher/groups/{groupId}:
 *   put:
 *     summary: Update group details, schedule, capacity, or cover photo
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               scheduleDays: { type: string }
 *               scheduleTime: { type: string }
 *               maxCapacity: { type: integer }
 *               defaultPrice: { type: number }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               cover: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Group updated successfully
 */
router.put('/groups/:groupId', uploadImage.single('cover'), validate(updateGroupSchema), TeacherController.updateGroup);

/**
 * @swagger
 * /teacher/groups/{groupId}:
 *   delete:
 *     summary: Soft-delete / deactivate study group
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Group deactivated
 */
router.delete('/groups/:groupId', TeacherController.deleteGroup);

/**
 * @swagger
 * /teacher/groups/{groupId}/qr-code:
 *   get:
 *     summary: Get group invitation QR code payload and share link
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: QR payload generated
 */
router.get('/groups/:groupId/qr-code', TeacherController.getGroupQrCode);

/**
 * @swagger
 * /teacher/groups/{groupId}/students:
 *   get:
 *     summary: Get group student roster with payment status, attendance rates, and scores
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Group student roster
 */
router.get('/groups/:groupId/students', TeacherController.getGroupStudents);

/**
 * @swagger
 * /teacher/groups/{groupId}/students:
 *   post:
 *     summary: Enroll student manually (Finds existing user or creates new student account with temp password)
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone]
 *             properties:
 *               fullName: { type: string, example: "أحمد حسام محمد" }
 *               phone: { type: string, example: "01020924779" }
 *               email: { type: string, example: "student@eureka-lms.com" }
 *               parentPhone: { type: string, example: "01011122334" }
 *               enrollmentPrice: { type: number, example: 300 }
 *     responses:
 *       201:
 *         description: Student enrolled successfully
 */
router.post('/groups/:groupId/students', validate(addStudentToGroupSchema), TeacherController.addStudentToGroup);

/**
 * @swagger
 * /teacher/students/{studentId}:
 *   get:
 *     summary: Get complete student modal details with attendance stats, exam/hw history, and payments
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Student modal detailed profile
 */
router.get('/students/:studentId', TeacherController.getStudentDetails);

/**
 * @swagger
 * /teacher/students/{studentId}:
 *   put:
 *     summary: Update student custom price, status, or transfer between teacher's groups
 *     tags: [11. Teacher Groups & Student Roster]
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enrollmentPrice: { type: number }
 *               targetGroupId: { type: string, format: uuid }
 *               status: { type: string, enum: [ACTIVE, SUSPENDED, LEFT] }
 *     responses:
 *       200:
 *         description: Student updated
 */
router.put('/students/:studentId', validate(updateStudentSchema), TeacherController.updateStudent);

// ----------------------------------------------------
// 12. Attendance & QR Roll-Call
// ----------------------------------------------------

/**
 * @swagger
 * /teacher/attendance/overview:
 *   get:
 *     summary: Get overall attendance KPIs, breakdown by group, and recent sessions
 *     tags: [12. Attendance & QR Roll-Call]
 *     responses:
 *       200:
 *         description: Attendance dashboard summary
 */
router.get('/attendance/overview', TeacherController.getAttendanceOverview);

/**
 * @swagger
 * /teacher/attendance/calendar:
 *   get:
 *     summary: Get calendar sessions history with attendance rates
 *     tags: [12. Attendance & QR Roll-Call]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: integer, example: 5 }
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *     responses:
 *       200:
 *         description: Monthly attendance calendar sessions
 */
router.get('/attendance/calendar', TeacherController.getAttendanceCalendar);

/**
 * @swagger
 * /teacher/attendance/sessions:
 *   post:
 *     summary: Create a class attendance session
 *     tags: [12. Attendance & QR Roll-Call]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId, title]
 *             properties:
 *               groupId: { type: string, format: uuid }
 *               title: { type: string, example: "حصة الفيزياء - الحركة الدائرية" }
 *               sessionDate: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Session created
 */
router.post('/attendance/sessions', validate(createSessionSchema), TeacherController.createAttendanceSession);

/**
 * @swagger
 * /teacher/attendance/sessions/{sessionId}/qr:
 *   get:
 *     summary: Generate live dynamic QR token and 6-digit PIN code with 10-minute TTL countdown
 *     tags: [12. Attendance & QR Roll-Call]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Live QR token and 6-digit session code
 */
router.get('/attendance/sessions/:sessionId/qr', TeacherController.generateSessionQr);

/**
 * @swagger
 * /teacher/attendance/sessions/{sessionId}/manual:
 *   post:
 *     summary: Batch record manual student roll-call (PRESENT / LATE / ABSENT)
 *     tags: [12. Attendance & QR Roll-Call]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [attendances]
 *             properties:
 *               attendances:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [studentId, status]
 *                   properties:
 *                     studentId: { type: string, format: uuid }
 *                     status: { type: string, enum: [PRESENT, LATE, ABSENT] }
 *     responses:
 *       200:
 *         description: Attendance saved
 */
router.post('/attendance/sessions/:sessionId/manual', validate(manualAttendanceSchema), TeacherController.manualAttendance);

/**
 * @swagger
 * /teacher/attendance/sessions/{sessionId}:
 *   get:
 *     summary: Get session attendance summary, present/late/absent counts, and student roster
 *     tags: [12. Attendance & QR Roll-Call]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Session attendance report
 */
router.get('/attendance/sessions/:sessionId', TeacherController.getSessionDetails);

// ----------------------------------------------------
// 13. Curriculum Content CRUD
// ----------------------------------------------------

/**
 * @swagger
 * /teacher/subjects:
 *   post:
 *     summary: Create private teacher subject with optional icon upload
 *     tags: [13. Curriculum Content CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [nameAr]
 *             properties:
 *               nameAr: { type: string, example: "فيزياء لغات" }
 *               nameEn: { type: string, example: "Physics" }
 *               icon: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Subject created
 */
router.post('/subjects', uploadImage.single('icon'), validate(createSubjectSchema), TeacherController.createSubject);

/**
 * @swagger
 * /teacher/subjects:
 *   get:
 *     summary: List all subjects taught by teacher (Global & Private)
 *     tags: [13. Curriculum Content CRUD]
 *     responses:
 *       200:
 *         description: List of teacher subjects
 */
router.get('/subjects', TeacherController.getTeacherSubjects);

/**
 * @swagger
 * /teacher/units:
 *   post:
 *     summary: Create curriculum unit under a subject and grade level
 *     tags: [13. Curriculum Content CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subjectId, gradeLevelId, title]
 *             properties:
 *               subjectId: { type: string, format: uuid }
 *               gradeLevelId: { type: string, format: uuid }
 *               title: { type: string, example: "الوحدة الأولى: الميكانيكا" }
 *               order: { type: integer, default: 1 }
 *     responses:
 *       201:
 *         description: Unit created
 */
router.post('/units', validate(createUnitSchema), TeacherController.createUnit);

/**
 * @swagger
 * /teacher/units/{unitId}:
 *   put:
 *     summary: Update unit title and ordering
 *     tags: [13. Curriculum Content CRUD]
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               order: { type: integer }
 *     responses:
 *       200:
 *         description: Unit updated
 */
router.put('/units/:unitId', validate(updateUnitSchema), TeacherController.updateUnit);

/**
 * @swagger
 * /teacher/units/{unitId}:
 *   delete:
 *     summary: Delete curriculum unit and all its lessons
 *     tags: [13. Curriculum Content CRUD]
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unit deleted
 */
router.delete('/units/:unitId', TeacherController.deleteUnit);

/**
 * @swagger
 * /teacher/lessons:
 *   post:
 *     summary: Create lesson under a unit
 *     tags: [13. Curriculum Content CRUD]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unitId, title]
 *             properties:
 *               unitId: { type: string, format: uuid }
 *               title: { type: string, example: "الدرس الأول: القوى والحركة" }
 *               description: { type: string, example: "شرح قوانين نيوتن" }
 *               order: { type: integer, default: 1 }
 *     responses:
 *       201:
 *         description: Lesson created
 */
router.post('/lessons', validate(createLessonSchema), TeacherController.createLesson);

/**
 * @swagger
 * /teacher/lessons/{lessonId}:
 *   put:
 *     summary: Update lesson title and description
 *     tags: [13. Curriculum Content CRUD]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               order: { type: integer }
 *     responses:
 *       200:
 *         description: Lesson updated
 */
router.put('/lessons/:lessonId', validate(updateLessonSchema), TeacherController.updateLesson);

/**
 * @swagger
 * /teacher/lessons/{lessonId}:
 *   delete:
 *     summary: Delete lesson and its attached media
 *     tags: [13. Curriculum Content CRUD]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lesson deleted
 */
router.delete('/lessons/:lessonId', TeacherController.deleteLesson);

/**
 * @swagger
 * /teacher/lessons/{lessonId}/videos:
 *   post:
 *     summary: Upload lesson video (Max 500MB) with optional group audience restriction
 *     tags: [13. Curriculum Content CRUD]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, video]
 *             properties:
 *               title: { type: string, example: "فيديو شرح الحركة الدائرية" }
 *               description: { type: string }
 *               durationSeconds: { type: integer, example: 1800 }
 *               groupId: { type: string, format: uuid }
 *               video: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Video uploaded
 */
router.post('/lessons/:lessonId/videos', uploadVideo.single('video'), validate(uploadVideoSchema), TeacherController.uploadLessonVideo);

/**
 * @swagger
 * /teacher/lessons/{lessonId}/materials:
 *   post:
 *     summary: Upload lesson study PDF / Word material (Max 10MB)
 *     tags: [13. Curriculum Content CRUD]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, document]
 *             properties:
 *               title: { type: string, example: "ملخص قوانين نيوتن PDF" }
 *               fileType: { type: string, enum: [PDF, DOC, DOCX] }
 *               groupId: { type: string, format: uuid }
 *               document: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Document uploaded
 */
router.post('/lessons/:lessonId/materials', uploadDocument.single('document'), validate(uploadMaterialSchema), TeacherController.uploadLessonMaterial);

/**
 * @swagger
 * /teacher/lessons/{lessonId}/media/{mediaType}/{mediaId}:
 *   delete:
 *     summary: Delete lesson media attachment (video or material)
 *     tags: [13. Curriculum Content CRUD]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: mediaType
 *         required: true
 *         schema: { type: string, enum: [video, material] }
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Media deleted
 */
router.delete('/lessons/:lessonId/media/:mediaType/:mediaId', TeacherController.deleteLessonMedia);

// ----------------------------------------------------
// 18. Teacher Profile & Settings
// ----------------------------------------------------

/**
 * @swagger
 * /teacher/profile:
 *   get:
 *     summary: Get teacher profile with assigned groups and stats
 *     tags: [18. Teacher Profile & Settings]
 *     responses:
 *       200:
 *         description: Teacher profile
 */
router.get('/profile', TeacherController.getProfile);

/**
 * @swagger
 * /teacher/profile:
 *   put:
 *     summary: Update teacher personal info and avatar photo
 *     tags: [18. Teacher Profile & Settings]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone: { type: string }
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', uploadImage.single('avatar'), validate(updateTeacherProfileSchema), TeacherController.updateProfile);

/**
 * @swagger
 * /teacher/settings:
 *   put:
 *     summary: Update teacher preferences (Language, Dark mode, Notification toggles)
 *     tags: [18. Teacher Profile & Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appLanguage: { type: string, enum: [ar, en, fr] }
 *               darkMode: { type: boolean }
 *               notifyExams: { type: boolean }
 *               notifySubjects: { type: boolean }
 *               notifyHomework: { type: boolean }
 *               notifyAnnouncements: { type: boolean }
 *     responses:
 *       200:
 *         description: Settings saved
 */
router.put('/settings', validate(updateTeacherSettingsSchema), TeacherController.updateSettings);

export default router;
