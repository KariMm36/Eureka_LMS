import { Router } from 'express';
import { HomeController } from './home.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// GET /api/v1/home
router.get('/', authenticate, HomeController.getHomeFeed);

export default router;
