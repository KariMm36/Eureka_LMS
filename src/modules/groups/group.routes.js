import { Router } from 'express';
import { GroupController } from './group.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { groupJoinLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { joinByCodeSchema } from './group.validation.js';

const router = Router();

// All group endpoints require authentication
router.use(authenticate);


/**
 * @swagger
 * /groups/search:
 *   get:
 *     summary: Search active study groups with pagination and filters
 *     tags: [04. Student - Groups & Enrollment]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: subjectId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: teacherId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated group list
 */
router.get('/search', GroupController.searchGroups);

/**
 * @swagger
 * /groups/preview/{groupCode}:
 *   get:
 *     summary: Preview teacher group details before joining by invitation code
 *     tags: [04. Student - Groups & Enrollment]
 *     parameters:
 *       - in: path
 *         name: groupCode
 *         required: true
 *         schema: { type: string, example: "PHY-10-A" }
 *     responses:
 *       200:
 *         description: Group preview data
 *       404:
 *         description: Invalid group code
 */
router.get('/preview/:groupCode', groupJoinLimiter, GroupController.previewGroupByCode);

/**
 * @swagger
 * /groups/join-by-code:
 *   post:
 *     summary: Enroll student in group using secret teacher code
 *     tags: [04. Student - Groups & Enrollment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupCode]
 *             properties:
 *               groupCode: { type: string, example: "PHY-10-A" }
 *     responses:
 *       200:
 *         description: Enrolled in group successfully
 *       400:
 *         description: Group is full or invalid
 *       409:
 *         description: Already enrolled
 */
router.post('/join-by-code', requireRole('STUDENT'), groupJoinLimiter, validate(joinByCodeSchema), GroupController.joinGroupByCode);

/**
 * @swagger
 * /groups/{groupId}/join:
 *   post:
 *     summary: Join an open group directly by ID
 *     tags: [04. Student - Groups & Enrollment]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Joined group
 */
router.post('/:groupId/join', requireRole('STUDENT'), GroupController.joinGroupById);

/**
 * @swagger
 * /groups/my-groups:
 *   get:
 *     summary: List all groups the student is actively enrolled in
 *     tags: [04. Student - Groups & Enrollment]
 *     responses:
 *       200:
 *         description: Enrolled groups list
 */
router.get('/my-groups', requireRole('STUDENT'), GroupController.getMyGroups);

/**
 * @swagger
 * /groups/{groupId}:
 *   get:
 *     summary: Get detailed group information, schedules, and teacher info
 *     tags: [04. Student - Groups & Enrollment]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Group details
 */
router.get('/:groupId', GroupController.getGroupDetails);

export default router;
