import swaggerJsDoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Eureka LMS API Documentation',
      version: '1.0.0',
      description: 'REST API documentation for Eureka LMS Mobile & Web Applications.',
      contact: {
        name: 'Eureka LMS Dev Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Local Development Server',
      },
    ],
    tags: [
      {
        name: '1. Authentication & Verification',
        description: 'Registration, 6-digit email OTP confirmation, login, refresh token rotation, and password reset.',
      },
      {
        name: '2. Academic Catalogue',
        description: 'Educational stages, grade levels, subject syllabus, units, and lesson content (videos/attachments).',
      },
      {
        name: '3. Student Onboarding & Profile',
        description: 'Student onboarding setup, full profile retrieval, avatar upload, and app preferences.',
      },
      {
        name: '4. Groups & Enrollment',
        description: 'Study group discovery, teacher invitation code preview, joining, and active enrollment list.',
      },
      {
        name: '5. Home Dashboard',
        description: 'Consolidated home feed, next class banner, today schedule, and upcoming deadlines carousel.',
      },
      {
        name: '6. Homework Engine',
        description: 'Pending/completed feeds, taking sanitized questions, auto-grading, essay minWords validation, and scorecards.',
      },
      {
        name: '7. Exams & Timed Quizzes',
        description: '4-color palette guidelines, server-time live session start, submission, and comprehensive report cards.',
      },
      {
        name: '8. Notifications & Push',
        description: 'Mobile FCM device token registration, in-app notification center, and read state management.',
      },
      {
        name: '9. Student Analytics',
        description: 'Aggregated completion rates, average scores, subject strengths, and dynamic peer ranking badges.',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Provide JWT access token in format: Bearer <token>',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            statusCode: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'تمت العملية بنجاح' },
            data: { type: 'object' },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            statusCode: { type: 'integer', example: 400 },
            message: { type: 'string', example: 'خطأ في الطلب' },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.js'],
};

export const swaggerSpec = swaggerJsDoc(swaggerOptions);
export const swaggerDocument = swaggerSpec;
export default swaggerSpec;
