import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger.config.js';

// Middlewares
import { requestIdMiddleware } from './middlewares/requestId.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { ApiResponse } from './utils/apiResponse.js';
import { ENV } from './config/env.config.js';
import prisma from './config/prisma.js';
import { logger } from './config/logger.config.js';

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

// Request Correlation ID Middleware (First in chain)
app.use(requestIdMiddleware);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
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


// 1. Lightweight Liveness Probe (process is alive)
app.get(['/health', '/api/v1/health'], (req, res) => {
  return ApiResponse.success(res, { status: 'healthy', timestamp: new Date() }, 'Eureka server is running successfully');
});

// 2. Comprehensive Readiness Probe (checks database connectivity)
app.get(['/health/readiness', '/api/v1/health/readiness'], async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'خادم يوريكا وقاعدة البيانات في حالة جاهزية تامة',
      data: {
        status: 'ready',
        database: 'connected',
        timestamp: new Date(),
      },
    });
  } catch (dbError) {
    logger.error({ err: dbError, requestId: req.id }, '[Readiness Probe Failed] Database unavailable');
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: 'الخدمة غير متاحة حالياً - تعذر الاتصال بقاعدة البيانات',
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date(),
      },
    });
  }
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
