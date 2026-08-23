import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.config.js';

// Middlewares
import { errorHandler } from './middlewares/error.middleware.js';
import { ApiResponse } from './utils/apiResponse.js';

// Feature Routes
import authRoutes from './modules/auth/auth.routes.js';
import studentRoutes from './modules/student/student.routes.js';
import academicRoutes from './modules/academic/academic.routes.js';
import groupRoutes from './modules/groups/group.routes.js';
import homeRoutes from './modules/home/home.routes.js';
import homeworkRoutes from './modules/homework/homework.routes.js';
import examRoutes from './modules/exams/exam.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global Middlewares
app.use(helmet({ contentSecurityPolicy: false })); // allow Swagger UI assets
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger API Documentation UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/docs', (req, res) => res.redirect('/api-docs'));

// Health Check API
app.get('/health', (req, res) => {
  return ApiResponse.success(res, { status: 'healthy', timestamp: new Date() }, 'خادم يوريكا يعمل بنجاح');
});

// API Routes (v1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/academic', academicRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/home', homeRoutes);
app.use('/api/v1/homework', homeworkRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// 404 Route Handler
app.use('*', (req, res) => {
  return res.status(404).json({
    success: false,
    statusCode: 404,
    message: `المسار المطلوب ${req.originalUrl} غير موجود على هذا الخادم`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
