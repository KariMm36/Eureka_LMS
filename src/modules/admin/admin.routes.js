import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadImage } from '../../config/multer.config.js';
import {
  updateUserStatusSchema,
  changeUserRoleSchema,
  adminResetPasswordSchema,
  transferEnrollmentSchema,
  manualEnrollSchema,
  createStageSchema,
  updateStageSchema,
  createSubjectSchema,
  updateSubjectSchema,
  adminBroadcastSchema,
  updatePlatformSettingsSchema,
  toggleGroupStatusSchema,
  assignGroupTeacherSchema,
  rejectTeacherSchema,
} from './admin.validation.js';

const router = Router();

// All Admin routes require authentication and ADMIN role
router.use(authenticate, authorize('ADMIN'));

// ----------------------------------------------------
// 1. Dashboard
// ----------------------------------------------------
/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Executive Platform KPIs & Overview
 *     tags: [22. Admin Management Portal]
 *     responses:
 *       200:
 *         description: Macro statistics across users, groups, revenue, and attendance
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/dashboard', AdminController.getDashboard);

// ----------------------------------------------------
// 2. Users Management
// ----------------------------------------------------
/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get paginated users directory with search & role filters
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [STUDENT, TEACHER, ADMIN] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, suspended, unverified, verified] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated users roster
 */
router.get('/users', AdminController.getUsers);

/**
 * @swagger
 * /admin/users/export:
 *   get:
 *     summary: Export full users roster to CSV (UTF-8 Excel compatible)
 *     tags: [22. Admin Management Portal]
 *     responses:
 *       200:
 *         description: CSV file attachment
 */
router.get('/users/export', AdminController.exportUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get detailed user dossier with enrolled groups and profile
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/users/:id', AdminController.getUserDetails);

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     summary: Suspend or reactivate user account (Revokes sessions immediately on suspension)
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: User account status updated
 *       400:
 *         description: Cannot suspend last admin
 */
router.patch('/users/:id/status', validate(updateUserStatusSchema), AdminController.updateUserStatus);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Change user platform role (Safeguards against removing last admin)
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [STUDENT, TEACHER, ADMIN] }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch('/users/:id/role', validate(changeUserRoleSchema), AdminController.changeUserRole);

/**
 * @swagger
 * /admin/users/{id}/force-logout:
 *   post:
 *     summary: Force logout user from all devices (Revokes refresh token & disconnects sockets)
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: All active sessions terminated
 */
router.post('/users/:id/force-logout', AdminController.forceLogoutUser);

/**
 * @swagger
 * /admin/users/{id}/reset-password:
 *   post:
 *     summary: Direct administrative password reset
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, minLength: 8 }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Password updated and sessions rotated
 */
router.post('/users/:id/reset-password', validate(adminResetPasswordSchema), AdminController.adminResetPassword);

// ----------------------------------------------------
// 3. Teachers Administration
// ----------------------------------------------------
/**
 * @swagger
 * /admin/teachers/pending:
 *   get:
 *     summary: Get unverified teacher applications queue
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Pending teachers list
 */
router.get('/teachers/pending', AdminController.getPendingTeachers);

/**
 * @swagger
 * /admin/teachers/{id}/approve:
 *   patch:
 *     summary: Approve teacher account & grant verified status with real-time alert
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Teacher approved successfully
 */
router.patch('/teachers/:id/approve', AdminController.approveTeacher);

/**
 * @swagger
 * /admin/teachers/{id}/reject:
 *   patch:
 *     summary: Reject / deactivate teacher application
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Teacher rejected
 */
router.patch('/teachers/:id/reject', validate(rejectTeacherSchema), AdminController.rejectTeacher);

/**
 * @swagger
 * /admin/teachers/{id}/stats:
 *   get:
 *     summary: 360° Teacher workload statistics (Groups, students, exams, revenue)
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Teacher 360 stats
 */
router.get('/teachers/:id/stats', AdminController.getTeacherStats);

// ----------------------------------------------------
// 4. Students Administration
// ----------------------------------------------------
/**
 * @swagger
 * /admin/students/{id}/history:
 *   get:
 *     summary: 360° Student lifetime academic dossier (Attendance %, homeworks, exams, receipts)
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Complete student academic record
 */
router.get('/students/:id/history', AdminController.getStudentHistory);

// ----------------------------------------------------
// 5. Groups Oversight
// ----------------------------------------------------
/**
 * @swagger
 * /admin/groups:
 *   get:
 *     summary: Platform-wide study groups directory
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: teacherId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated groups list
 */
router.get('/groups', AdminController.getGroups);

/**
 * @swagger
 * /admin/groups/{id}:
 *   get:
 *     summary: Get group details with enrolled student roster
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Group details with student roster
 */
router.get('/groups/:id', AdminController.getGroupDetails);

/**
 * @swagger
 * /admin/groups/{id}/toggle:
 *   patch:
 *     summary: Toggle group active/inactive status
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Group status updated
 */
router.patch('/groups/:id/toggle', validate(toggleGroupStatusSchema), AdminController.toggleGroupStatus);

/**
 * @swagger
 * /admin/groups/{id}/assign-teacher:
 *   patch:
 *     summary: Reassign study group to a new teacher
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teacherId]
 *             properties:
 *               teacherId: { type: string, format: uuid }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Group reassigned
 */
router.patch('/groups/:id/assign-teacher', validate(assignGroupTeacherSchema), AdminController.assignGroupTeacher);

// ----------------------------------------------------
// 6. Enrollments & Transfers
// ----------------------------------------------------
/**
 * @swagger
 * /admin/enrollments:
 *   post:
 *     summary: Direct administrative manual student enrollment into a group
 *     tags: [22. Admin Management Portal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentProfileId, groupId]
 *             properties:
 *               studentProfileId: { type: string, format: uuid }
 *               groupId: { type: string, format: uuid }
 *               enrollmentPrice: { type: number }
 *               reason: { type: string }
 *     responses:
 *       201:
 *         description: Student enrolled
 *       400:
 *         description: Group is full
 */
router.post('/enrollments', validate(manualEnrollSchema), AdminController.manualEnroll);

/**
 * @swagger
 * /admin/enrollments/transfer:
 *   post:
 *     summary: Transactional student transfer between study groups (Preserving historical test/attendance records)
 *     tags: [22. Admin Management Portal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentProfileId, fromGroupId, toGroupId]
 *             properties:
 *               studentProfileId: { type: string, format: uuid }
 *               fromGroupId: { type: string, format: uuid }
 *               toGroupId: { type: string, format: uuid }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Student transferred successfully
 */
router.post('/enrollments/transfer', validate(transferEnrollmentSchema), AdminController.transferStudent);

// ----------------------------------------------------
// 7. Academic Catalogue
// ----------------------------------------------------
/**
 * @swagger
 * /admin/stages:
 *   post:
 *     summary: Create new educational stage
 *     tags: [22. Admin Management Portal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, nameAr, nameEn]
 *             properties:
 *               key: { type: string, enum: [PRIMARY, PREPARATORY, SECONDARY] }
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               order: { type: integer }
 *     responses:
 *       201:
 *         description: Stage created
 */
router.post('/stages', validate(createStageSchema), AdminController.createStage);

/**
 * @swagger
 * /admin/stages/{id}:
 *   put:
 *     summary: Update educational stage details
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               order: { type: integer }
 *     responses:
 *       200:
 *         description: Stage updated
 */
router.put('/stages/:id', validate(updateStageSchema), AdminController.updateStage);

/**
 * @swagger
 * /admin/subjects:
 *   post:
 *     summary: Create global curriculum subject with optional icon upload
 *     tags: [22. Admin Management Portal]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [nameAr, nameEn]
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               icon: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Subject created
 */
router.post('/subjects', uploadImage.single('icon'), validate(createSubjectSchema), AdminController.createSubject);

/**
 * @swagger
 * /admin/subjects/{id}:
 *   put:
 *     summary: Update subject info or icon
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               icon: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Subject updated
 */
router.put('/subjects/:id', uploadImage.single('icon'), validate(updateSubjectSchema), AdminController.updateSubject);

/**
 * @swagger
 * /admin/subjects/{id}:
 *   delete:
 *     summary: Soft-archive subject to preserve historical lessons and exams
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Subject archived
 */
router.delete('/subjects/:id', AdminController.archiveSubject);

// ----------------------------------------------------
// 8. Attendance Administration
// ----------------------------------------------------
/**
 * @swagger
 * /admin/attendance/overview:
 *   get:
 *     summary: Platform-wide attendance KPIs and presence rates
 *     tags: [22. Admin Management Portal]
 *     responses:
 *       200:
 *         description: Attendance overview stats
 */
router.get('/attendance/overview', AdminController.getAttendanceOverview);

/**
 * @swagger
 * /admin/attendance/at-risk:
 *   get:
 *     summary: Get at-risk students with attendance rate below threshold (< 75%)
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema: { type: number, default: 75 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: At-risk students list
 */
router.get('/attendance/at-risk', AdminController.getAtRiskStudents);

/**
 * @swagger
 * /admin/attendance/export:
 *   get:
 *     summary: Export attendance session records to CSV (UTF-8 Excel compatible)
 *     tags: [22. Admin Management Portal]
 *     responses:
 *       200:
 *         description: CSV file attachment
 */
router.get('/attendance/export', AdminController.exportAttendance);

// ----------------------------------------------------
// 9. Finance Administration
// ----------------------------------------------------
/**
 * @swagger
 * /admin/finance/summary:
 *   get:
 *     summary: Platform revenue KPIs and payment methods breakdown
 *     tags: [22. Admin Management Portal]
 *     responses:
 *       200:
 *         description: Revenue summary
 */
router.get('/finance/summary', AdminController.getFinanceSummary);

/**
 * @swagger
 * /admin/finance/payments:
 *   get:
 *     summary: Paginated student payment receipts ledger
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: query
 *         name: groupId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: paymentMethod
 *         schema: { type: string, enum: [CASH, VODAFONE_CASH, INSTAPAY, CARD] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Payments ledger
 */
router.get('/finance/payments', AdminController.getPaymentsList);

/**
 * @swagger
 * /admin/finance/unpaid:
 *   get:
 *     summary: Active enrolled students with unpaid fee dues for current cycle
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Unpaid students roster
 */
router.get('/finance/unpaid', AdminController.getUnpaidStudents);

/**
 * @swagger
 * /admin/finance/export:
 *   get:
 *     summary: Export financial payment receipts to CSV (UTF-8 Excel compatible)
 *     tags: [22. Admin Management Portal]
 *     responses:
 *       200:
 *         description: CSV file attachment
 */
router.get('/finance/export', AdminController.exportFinance);

// ----------------------------------------------------
// 10. Broadcasts
// ----------------------------------------------------
/**
 * @swagger
 * /admin/broadcast:
 *   post:
 *     summary: Multi-channel platform broadcast (In-App DB + Socket.IO + FCM Push multicast)
 *     tags: [22. Admin Management Portal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetAudience, title, message]
 *             properties:
 *               targetAudience: { type: string, enum: [ALL, STUDENTS, TEACHERS] }
 *               title: { type: string }
 *               message: { type: string }
 *               type: { type: string, enum: [ANNOUNCEMENT, LESSON, EXAM, HOMEWORK] }
 *     responses:
 *       200:
 *         description: Broadcast dispatched to targeted recipients
 */
router.post('/broadcast', validate(adminBroadcastSchema), AdminController.sendBroadcast);

// ----------------------------------------------------
// 11. Platform Settings & Maintenance
// ----------------------------------------------------
/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get platform settings (Maintenance mode, registration toggle, support info)
 *     tags: [22. Admin Management Portal]
 *     responses:
 *       200:
 *         description: Platform settings object
 */
router.get('/settings', AdminController.getSettings);

/**
 * @swagger
 * /admin/settings:
 *   patch:
 *     summary: Update platform settings & toggle Maintenance Mode (503 Service Unavailable for non-admins)
 *     tags: [22. Admin Management Portal]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maintenanceMode: { type: boolean }
 *               registrationOpen: { type: boolean }
 *               supportEmail: { type: string }
 *               supportPhone: { type: string }
 *     responses:
 *       200:
 *         description: Platform settings saved
 */
router.patch('/settings', validate(updatePlatformSettingsSchema), AdminController.updateSettings);

// ----------------------------------------------------
// 12. Audit Logs
// ----------------------------------------------------
/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Get paginated append-only administrative audit trail
 *     tags: [22. Admin Management Portal]
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *       - in: query
 *         name: adminId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated audit trail records
 */
router.get('/audit-logs', AdminController.getAuditLogs);

export default router;
