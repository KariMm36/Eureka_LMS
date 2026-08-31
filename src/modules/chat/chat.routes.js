import { Router } from 'express';
import { ChatController } from './chat.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createConversationSchema, sendMessageSchema } from './chat.validation.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /chat/conversations:
 *   post:
 *     summary: Start or find existing 1-on-1 conversation with a group teacher
 *     tags: [20. Student & Teacher 1-on-1 Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId]
 *             properties:
 *               groupId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Conversation retrieved or created
 *       403:
 *         description: Student not actively enrolled in group
 */
router.post(
  '/conversations',
  authorize('STUDENT'),
  validate(createConversationSchema),
  ChatController.createOrGetConversation
);

/**
 * @swagger
 * /chat/teacher/conversations:
 *   get:
 *     summary: Get teacher inbox conversations list
 *     tags: [20. Student & Teacher 1-on-1 Chat]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: groupId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated teacher inbox
 */
router.get(
  '/teacher/conversations',
  authorize('TEACHER'),
  ChatController.getTeacherConversations
);

/**
 * @swagger
 * /chat/student/conversations:
 *   get:
 *     summary: Get student inbox conversations list
 *     tags: [20. Student & Teacher 1-on-1 Chat]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated student inbox
 */
router.get(
  '/student/conversations',
  authorize('STUDENT'),
  ChatController.getStudentConversations
);

/**
 * @swagger
 * /chat/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get paginated message history for a conversation in chronological order
 *     tags: [20. Student & Teacher 1-on-1 Chat]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Paginated messages array
 *       403:
 *         description: Unauthorized to view conversation
 */
router.get(
  '/conversations/:conversationId/messages',
  ChatController.getConversationMessages
);

/**
 * @swagger
 * /chat/conversations/{conversationId}/messages:
 *   post:
 *     summary: Send message to conversation (HTTP Fallback)
 *     tags: [20. Student & Teacher 1-on-1 Chat]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *               attachmentUrl: { type: string }
 *     responses:
 *       201:
 *         description: Message persisted and delivered
 *       403:
 *         description: Unauthorized to send message
 */
router.post(
  '/conversations/:conversationId/messages',
  validate(sendMessageSchema),
  ChatController.sendMessage
);

/**
 * @swagger
 * /chat/conversations/{conversationId}/read:
 *   patch:
 *     summary: Mark received conversation messages as read and reset unread badge counter
 *     tags: [20. Student & Teacher 1-on-1 Chat]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Read status updated
 */
router.patch(
  '/conversations/:conversationId/read',
  ChatController.markConversationAsRead
);

export default router;
