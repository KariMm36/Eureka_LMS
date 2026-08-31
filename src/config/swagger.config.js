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
        url: 'https://eureka.growfet.com/api/v1',
        description: 'Production Live Server (eureka.growfet.com)',
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Local Development Server',
      },
    ],
    tags: [
      // 1. Authentication
      {
        name: '01. Authentication & Verification',
        description: 'Registration, 6-digit email OTP confirmation, login, refresh token rotation, and password reset.',
      },

      // 2. Student APIs
      {
        name: '02. Student - Profile & Onboarding',
        description: 'Student onboarding setup, full profile retrieval, avatar upload, and app preferences.',
      },
      {
        name: '03. Student - Academic Catalogue',
        description: 'Educational stages, grade levels, subject syllabus, units, and lesson content (videos/attachments).',
      },
      {
        name: '04. Student - Groups & Enrollment',
        description: 'Study group discovery, teacher invitation code preview, joining, and active enrollment list.',
      },
      {
        name: '05. Student - Home Dashboard',
        description: 'Consolidated home feed, next class banner, today schedule, and upcoming deadlines carousel.',
      },
      {
        name: '06. Student - Homework Engine',
        description: 'Pending/completed feeds, taking sanitized questions, auto-grading, essay minWords validation, and scorecards.',
      },
      {
        name: '07. Student - Exams & Timed Quizzes',
        description: '4-color palette guidelines, server-time live session start, submission, and comprehensive report cards.',
      },
      {
        name: '08. Student - Analytics & Badges',
        description: 'Aggregated completion rates, average scores, subject strengths, and dynamic peer ranking badges.',
      },

      // 3. Teacher APIs
      {
        name: '09. Teacher - Dashboard',
        description: 'Teacher consolidated dashboard KPIs, class schedule today, revenue collection stats, and active exam roster.',
      },
      {
        name: '10. Teacher - Groups & Student Roster',
        description: 'Group CRUD, cover photo, student roster with payment status, custom pricing, and find-or-create enrollment.',
      },
      {
        name: '11. Teacher - Attendance & QR Roll-Call',
        description: 'Live QR attendance generation (10-min TTL), manual roll-call batching, and session attendance reports.',
      },
      {
        name: '12. Teacher - Curriculum Content CRUD',
        description: 'Teacher private subjects, units, lessons, 500MB video uploads, and 10MB study PDF materials.',
      },
      {
        name: '13. Teacher - Homework Authoring Wizard',
        description: 'Homework authoring wizard with nested MCQ/Essay questions, model answers, and student submissions roster.',
      },
      {
        name: '14. Teacher - Exam Authoring Wizard',
        description: 'Exam authoring wizard with time window, passing percentage, attempts tracker, and nested questions builder.',
      },
      {
        name: '15. Teacher - Manual Essay Grading Queue',
        description: 'Unified pending essay grading inbox with instant FCM push notification dispatch upon scoring.',
      },
      {
        name: '16. Teacher - Comprehensive Grade Sheet',
        description: 'Leaderboard scorecard (كشف درجات الطلاب) showing all enrolled students, rankings, and summary statistics.',
      },
      {
        name: '17. Teacher - Income & Payment Ledger',
        description: 'Financial KPI summary, paid/unpaid rosters, per-student pricing, and receipt payment records.',
      },
      {
        name: '18. Teacher - Broadcast Notifications',
        description: 'Group, stage, and grade-level broadcast announcements dispatched to students with FCM push notifications.',
      },
      {
        name: '19. Teacher - Profile & Settings',
        description: 'Teacher personal profile, avatar photo upload, language selection, and notification preference settings.',
      },

      // 4. Chat & General Notifications
      {
        name: '20. Student & Teacher 1-on-1 Chat',
        description: 'Student-Teacher direct group messaging, inbox threads, message history, read receipts, and Socket.IO real-time delivery.',
      },
      {
        name: '21. Notifications & FCM Push',
        description: 'Mobile FCM device token registration, in-app notification center, and read state management.',
      },

      // 5. Admin Portal (At the End)
      {
        name: '22. Admin Management Portal',
        description: 'Platform executive dashboard, user lifecycle, teacher verification, student academic records, group oversight, finance ledger, attendance analytics, and maintenance controls.',
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
