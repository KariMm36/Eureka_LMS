export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Eureka LMS Mobile Backend API',
    version: '1.0.0',
    description: 'Interactive Swagger API Documentation for the Eureka Learning Management System (LMS) Mobile App Backend.',
  },
  servers: [
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from Login or Registration.',
      },
    },
  },
  tags: [
    { name: '1. Authentication', description: 'User registration, login, forgot password OTP, reset, and password update' },
    { name: '2. Academic Catalogue', description: 'Educational stages, grades, subjects list, units, and lesson details' },
    { name: '3. Student Profile & Settings', description: 'Student onboarding, personal profile, parent phone number, avatar upload, and app preferences' },
    { name: '4. Groups & Enrollment', description: 'Group search, join by teacher code, join open groups, and enrolled groups list' },
    { name: '5. Home Dashboard', description: 'Single aggregated mobile home feed with timetable, next lesson banner, and homework countdowns' },
    { name: '6. Notifications', description: 'Notifications feed, read/unread filters, and Firebase FCM push tokens' },
  ],
  paths: {
    // ----------------------------------------------------
    // 1. Authentication
    // ----------------------------------------------------
    '/auth/register': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Register New Student or Teacher Account',
        description: 'Creates a new user account and sends a styled Welcome Email.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'email', 'phone', 'password', 'confirmPassword'],
                properties: {
                  fullName: { type: 'string', example: 'أحمد عماد محمد' },
                  email: { type: 'string', example: 'student@eureka.com' },
                  phone: { type: 'string', example: '01020324779', description: '11-digit Egyptian phone number (010, 011, 012, 015)' },
                  password: { type: 'string', example: 'Password@123' },
                  confirmPassword: { type: 'string', example: 'Password@123' },
                  role: { type: 'string', enum: ['STUDENT', 'TEACHER'], default: 'STUDENT' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created successfully with JWT token' },
          409: { description: 'Email or phone already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Login User',
        description: 'Authenticates with email and password, returning JWT access token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'student@eureka.com' },
                  password: { type: 'string', example: 'Password@123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          400: { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Request 6-Digit OTP for Password Reset',
        description: 'Generates a 6-digit OTP code with a 10-minute expiry and sends it via Gmail SMTP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'student@eureka.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Verification OTP sent to email' },
          404: { description: 'Email not found' },
        },
      },
    },
    '/auth/verify-otp': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Verify 6-Digit OTP Code',
        description: 'Verifies the OTP code and returns a temporary 15-minute resetToken.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'otpCode'],
                properties: {
                  email: { type: 'string', example: 'student@eureka.com' },
                  otpCode: { type: 'string', example: '584920' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'OTP verified, resetToken returned' },
          400: { description: 'Invalid or expired OTP' },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['1. Authentication'],
        summary: 'Reset Password with resetToken',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'resetToken', 'newPassword', 'confirmPassword'],
                properties: {
                  email: { type: 'string', example: 'student@eureka.com' },
                  resetToken: { type: 'string', example: 'eyJhbGci...' },
                  newPassword: { type: 'string', example: 'NewPassword@123' },
                  confirmPassword: { type: 'string', example: 'NewPassword@123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset successfully' },
        },
      },
    },
    '/auth/update-password': {
      put: {
        tags: ['1. Authentication'],
        summary: 'Update Password (Logged-In User)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword', 'confirmPassword'],
                properties: {
                  currentPassword: { type: 'string', example: 'Password@123' },
                  newPassword: { type: 'string', example: 'NewPassword@123' },
                  confirmPassword: { type: 'string', example: 'NewPassword@123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password updated successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['1. Authentication'],
        summary: 'Get Current Authenticated User Profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Authenticated user details' },
        },
      },
    },

    // ----------------------------------------------------
    // 2. Academic Catalogue
    // ----------------------------------------------------
    '/academic/stages': {
      get: {
        tags: ['2. Academic Catalogue'],
        summary: 'Get All Educational Stages & Grades',
        description: 'Returns Primary, Preparatory, and Secondary stages with grade levels (Cached in-memory).',
        responses: {
          200: { description: 'List of stages and grades' },
        },
      },
    },
    '/academic/subjects': {
      get: {
        tags: ['2. Academic Catalogue'],
        summary: 'Get All Core Subjects',
        description: 'Returns all 8+ core subjects (Arabic, Math, CS, English, PE, Art, Religion, Science, Physics, Chemistry, Biology) with icons.',
        parameters: [
          { name: 'gradeLevelId', in: 'query', schema: { type: 'string' }, description: 'Optional grade filter' },
        ],
        responses: {
          200: { description: 'List of subjects' },
        },
      },
    },
    '/academic/subjects/{subjectId}/topics': {
      get: {
        tags: ['2. Academic Catalogue'],
        summary: 'Get Subject Units & Topics List',
        parameters: [
          { name: 'subjectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'gradeLevelId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Units and lessons for subject' },
        },
      },
    },
    '/academic/lessons/{lessonId}': {
      get: {
        tags: ['2. Academic Catalogue'],
        summary: 'Get Lesson Details with Videos & Summary PDFs',
        parameters: [
          { name: 'lessonId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Lesson overview, video stream links, and attached PDFs' },
        },
      },
    },

    // ----------------------------------------------------
    // 3. Student Profile & Settings
    // ----------------------------------------------------
    '/students/onboarding': {
      post: {
        tags: ['3. Student Profile & Settings'],
        summary: 'Complete Initial Student Onboarding (Stage, Grade & Subjects)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['stageId', 'gradeLevelId', 'selectedSubjectIds'],
                properties: {
                  stageId: { type: 'string', example: 'stage-uuid' },
                  gradeLevelId: { type: 'string', example: 'grade-uuid' },
                  selectedSubjectIds: { type: 'array', items: { type: 'string' } },
                  parentPhone: { type: 'string', example: '01020824778', description: 'رقم ولي الأمر' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Onboarding completed and subjects saved' },
        },
      },
    },
    '/students/profile': {
      get: {
        tags: ['3. Student Profile & Settings'],
        summary: 'Get Student Full Profile Details',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Profile with stage, grade, parent phone, subjects, and enrolled groups' },
        },
      },
      put: {
        tags: ['3. Student Profile & Settings'],
        summary: 'Edit Personal Details & Avatar Upload',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  fullName: { type: 'string', example: 'أحمد عماد محمد' },
                  phone: { type: 'string', example: '01020324779' },
                  parentPhone: { type: 'string', example: '01020824778' },
                  gradeLevelId: { type: 'string' },
                  avatar: { type: 'string', format: 'binary', description: 'Max 5MB JPG, PNG, WEBP' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated successfully' },
        },
      },
    },
    '/students/subjects': {
      put: {
        tags: ['3. Student Profile & Settings'],
        summary: 'Update Selected Subjects List',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['selectedSubjectIds'],
                properties: {
                  selectedSubjectIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Subjects updated' },
        },
      },
    },
    '/students/settings': {
      put: {
        tags: ['3. Student Profile & Settings'],
        summary: 'Update Language, Dark Mode & Notification Toggles',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  appLanguage: { type: 'string', enum: ['ar', 'en', 'fr', 'es'], default: 'ar' },
                  darkMode: { type: 'boolean', default: true },
                  notifyExams: { type: 'boolean', default: true },
                  notifySubjects: { type: 'boolean', default: true },
                  notifyHomework: { type: 'boolean', default: true },
                  notifyAnnouncements: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Settings saved' },
        },
      },
    },

    // ----------------------------------------------------
    // 4. Groups & Enrollment
    // ----------------------------------------------------
    '/groups/search': {
      get: {
        tags: ['4. Groups & Enrollment'],
        summary: 'Search & Browse Active Groups with Pagination',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'query', in: 'query', schema: { type: 'string' }, description: 'Keyword search (Subject, Teacher, Group name)' },
          { name: 'subjectId', in: 'query', schema: { type: 'string' } },
          { name: 'stageId', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Paginated list of groups with schedule, capacity, and teacher info' },
        },
      },
    },
    '/groups/preview/{groupCode}': {
      get: {
        tags: ['4. Groups & Enrollment'],
        summary: 'Preview Group Details by Teacher Code',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'groupCode', in: 'path', required: true, schema: { type: 'string', example: 'PHY-10-A' } },
        ],
        responses: {
          200: { description: 'Group preview details' },
          404: { description: 'Invalid group code' },
        },
      },
    },
    '/groups/join-by-code': {
      post: {
        tags: ['4. Groups & Enrollment'],
        summary: 'Join Group Using Teacher Code',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['groupCode'],
                properties: {
                  groupCode: { type: 'string', example: 'PHY-10-A' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Enrolled into group successfully' },
          400: { description: 'Group is full or code invalid' },
          409: { description: 'Already enrolled' },
        },
      },
    },
    '/groups/{groupId}/join': {
      post: {
        tags: ['4. Groups & Enrollment'],
        summary: 'Join Open Group Directly by Group ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Enrolled into open group' },
        },
      },
    },
    '/groups/my-groups': {
      get: {
        tags: ['4. Groups & Enrollment'],
        summary: 'Get List of Enrolled Groups',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'List of student active groups' },
        },
      },
    },
    '/groups/{groupId}': {
      get: {
        tags: ['4. Groups & Enrollment'],
        summary: 'Get Single Group Overview (Schedule, Homework & Tests)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'groupId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Full group overview' },
        },
      },
    },

    // ----------------------------------------------------
    // 5. Home Dashboard
    // ----------------------------------------------------
    '/home': {
      get: {
        tags: ['5. Home Dashboard'],
        summary: 'Get Unified Student Home Feed',
        description: 'Single fast aggregated call returning student greeting, next class banner, today timetable, pending homework countdowns, and upcoming exam alerts.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Complete Home Dashboard feed' },
        },
      },
    },

    // ----------------------------------------------------
    // 6. Notifications
    // ----------------------------------------------------
    '/notifications': {
      get: {
        tags: ['6. Notifications'],
        summary: 'Get Notifications Feed with Filter (All / Read / Unread)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'filter', in: 'query', schema: { type: 'string', enum: ['all', 'read', 'unread'], default: 'all' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'List of notifications and unread counter' },
        },
      },
    },
    '/notifications/{id}': {
      get: {
        tags: ['6. Notifications'],
        summary: 'Get Notification Details with Attachments & Action Link',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Notification details with attached files and target lesson link' },
        },
      },
    },
    '/notifications/read-all': {
      patch: {
        tags: ['6. Notifications'],
        summary: 'Mark All Notifications as Read',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'All notifications marked as read' },
        },
      },
    },
    '/notifications/fcm-token': {
      post: {
        tags: ['6. Notifications'],
        summary: 'Register Mobile Firebase Push Token (FCM)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fcmToken'],
                properties: {
                  fcmToken: { type: 'string', example: 'fcm_device_token_sample_xyz' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'FCM Token registered' },
        },
      },
    },
  },
};
