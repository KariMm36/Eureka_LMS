import { Router } from 'express';
import { GroupController } from './group.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { groupJoinLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { joinByCodeSchema } from './group.validation.js';

const router = Router();

// All group endpoints require authentication
router.use(authenticate);

// Group search and discovery
router.get('/search', GroupController.searchGroups);
router.get('/preview/:groupCode', groupJoinLimiter, GroupController.previewGroupByCode);
router.post('/join-by-code', groupJoinLimiter, validate(joinByCodeSchema), GroupController.joinGroupByCode);
router.post('/:groupId/join', GroupController.joinGroupById);
router.get('/my-groups', GroupController.getMyGroups);
router.get('/:groupId', GroupController.getGroupDetails);

export default router;
