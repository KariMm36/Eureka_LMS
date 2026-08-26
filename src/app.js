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
import { ENV } from './config/env.config.js';

// Feature Routes
import authRoutes from './modules/auth/auth.routes.js';
import studentRoutes from './modules/student/student.routes.js';
import academicRoutes from './modules/academic/academic.routes.js';
import groupRoutes from './modules/groups/group.routes.js';
import homeRoutes from './modules/home/home.routes.js';
import homeworkRoutes from './modules/homework/homework.routes.js';
import examRoutes from './modules/exams/exam.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import teacherRoutes from './modules/teacher/teacher.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global Middlewares
app.use(helmet({ contentSecurityPolicy: false })); // allow Swagger UI assets
// Configure CORS allow-list from env var CORS_ORIGINS (comma-separated)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ENV.NODE_ENV === 'development'
  ? ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:19006', 'http://localhost:8081']
  : [];

if (ENV.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn('[Eureka] WARNING: CORS_ORIGINS is not set in production — all cross-origin requests will be blocked');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: Origin ${origin} is not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger API Documentation UI
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'list',
      filter: true,
    },
  })
);
app.use('/docs', (req, res) => res.redirect('/api-docs'));


// Health Check API (accessible at both /health and /api/v1/health)
app.get(['/health', '/api/v1/health'], (req, res) => {
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
app.use('/api/v1/teacher', teacherRoutes);

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
