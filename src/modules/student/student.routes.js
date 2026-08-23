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

router.post('/onboarding', validate(onboardingSchema), StudentController.completeOnboarding);
router.get('/profile', StudentController.getProfile);
router.put('/profile', upload.single('avatar'), validate(updateProfileSchema), StudentController.updateProfile);
router.put('/subjects', validate(updateSubjectsSchema), StudentController.updateSubjects);
router.put('/settings', validate(updateSettingsSchema), StudentController.updateSettings);

export default router;
