# 📖 Eureka LMS - REST API Reference

- **Base URL**: `http://localhost:5000/api/v1`
- **Interactive Swagger Docs**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **Authentication**: `Authorization: Bearer <JWT_TOKEN>`

---

## 📑 Table of Contents
1. [Authentication (`/auth`)](#1-authentication)
2. [Academic Catalogue (`/academic`)](#2-academic-catalogue)
3. [Student Profile, Settings & Analytics (`/students`)](#3-student-profile-settings--analytics)
4. [Groups & Enrollment (`/groups`)](#4-groups--enrollment)
5. [Home Dashboard Aggregator (`/home`)](#5-home-dashboard)
6. [Homework Engine (`/homework`)](#6-homework-engine)
7. [Exams & Quizzes Timed Engine (`/exams`)](#7-exams--quizzes-timed-engine)
8. [Notifications (`/notifications`)](#8-notifications)

---

## 1. Authentication

### 1.1 Register Account
Creates a new student or teacher account and sends an automated **Welcome Email** via Gmail SMTP.
- **Method**: `POST`
- **URL**: `/api/v1/auth/register`
- **Auth**: None
- **Request Body**:
```json
{
  "fullName": "أحمد عماد محمد",
  "email": "student@eureka.com",
  "phone": "01020324779",
  "password": "Password@123",
  "confirmPassword": "Password@123",
  "role": "STUDENT"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "تم إنشاء الحساب بنجاح",
  "data": {
    "user": {
      "id": "user-uuid",
      "fullName": "أحمد عماد محمد",
      "email": "student@eureka.com",
      "phone": "01020324779",
      "role": "STUDENT"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.2 Login
- **Method**: `POST`
- **URL**: `/api/v1/auth/login`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "student@eureka.com",
  "password": "Password@123"
}
```

---

### 1.3 Forgot Password (Request OTP)
Generates a 6-digit OTP code with a 10-minute expiry and delivers it to the user's email inbox.
- **Method**: `POST`
- **URL**: `/api/v1/auth/forgot-password`
- **Auth**: None
- **Request Body**: `{ "email": "student@eureka.com" }`

---

### 1.4 Verify OTP Code
- **Method**: `POST`
- **URL**: `/api/v1/auth/verify-otp`
- **Auth**: None
- **Request Body**: `{ "email": "student@eureka.com", "otpCode": "584920" }`

---

### 1.5 Reset Password
- **Method**: `POST`
- **URL**: `/api/v1/auth/reset-password`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "student@eureka.com",
  "resetToken": "eyJhbGci...",
  "newPassword": "NewPassword@123",
  "confirmPassword": "NewPassword@123"
}
```

---

### 1.6 Update Password (Logged-In User)
- **Method**: `PUT`
- **URL**: `/api/v1/auth/update-password`
- **Auth**: `Bearer <TOKEN>`

---

### 1.7 Get Current Authenticated Profile
- **Method**: `GET`
- **URL**: `/api/v1/auth/me`
- **Auth**: `Bearer <TOKEN>`

---

## 2. Academic Catalogue

### 2.1 Get Educational Stages & Grades
Returns Primary, Preparatory, and Secondary stages with grade levels (served from high-speed in-memory cache in 1ms).
- **Method**: `GET`
- **URL**: `/api/v1/academic/stages`
- **Auth**: None

---

### 2.2 Get Core Subjects List
- **Method**: `GET`
- **URL**: `/api/v1/academic/subjects`
- **Query Params**: `gradeLevelId` (optional)
- **Auth**: None

---

### 2.3 Get Subject Units & Lessons
- **Method**: `GET`
- **URL**: `/api/v1/academic/subjects/:subjectId/topics`
- **Auth**: None

---

### 2.4 Get Lesson Details
- **Method**: `GET`
- **URL**: `/api/v1/academic/lessons/:lessonId`
- **Auth**: None
- **Success Response (`200 OK`)**: Returns full lesson info with streaming links, downloadable summary PDFs, and linked quiz/homework IDs.

---

## 3. Student Profile, Settings & Analytics

### 3.1 Complete Student Onboarding
- **Method**: `POST`
- **URL**: `/api/v1/students/onboarding`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**:
```json
{
  "stageId": "stage-primary-uuid",
  "gradeLevelId": "grade-6-uuid",
  "selectedSubjectIds": ["subj-math-uuid", "subj-phys-uuid"],
  "parentPhone": "01020824778"
}
```

---

### 3.2 Get Student Profile
- **Method**: `GET`
- **URL**: `/api/v1/students/profile`
- **Auth**: `Bearer <TOKEN>`

---

### 3.3 Get Student Analytics & Performance Breakdown 📊
- **Method**: `GET`
- **URL**: `/api/v1/students/analytics`
- **Auth**: `Bearer <TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تقرير تحليلات أداء ومستوى الطالب",
  "data": {
    "homeworkAnalytics": {
      "totalAssigned": 12,
      "completed": 10,
      "pending": 2,
      "completionRatePercentage": 83,
      "averageScorePercentage": 88
    },
    "examAnalytics": {
      "totalAssigned": 4,
      "completed": 3,
      "passed": 3,
      "failed": 0,
      "overallAveragePercentage": 92
    },
    "rankBadge": "أنت ضمن أعلى 15% من الطلاب",
    "subjectStrengths": [
      {
        "subjectId": "subj-phys",
        "subjectName": "الفيزياء",
        "performancePercentage": 95,
        "status": "ممتاز"
      },
      {
        "subjectId": "subj-math",
        "subjectName": "الرياضيات",
        "performancePercentage": 88,
        "status": "ممتاز"
      }
    ]
  }
}
```

---

### 3.4 Update Personal Profile & Avatar
- **Method**: `PUT`
- **URL**: `/api/v1/students/profile`
- **Auth**: `Bearer <TOKEN>`
- **Content-Type**: `multipart/form-data` (Max 5MB Avatar upload)

---

### 3.5 Update App Settings
- **Method**: `PUT`
- **URL**: `/api/v1/students/settings`
- **Auth**: `Bearer <TOKEN>`

---

## 4. Groups & Enrollment

### 4.1 Search & Browse Groups (Paginated)
- **Method**: `GET`
- **URL**: `/api/v1/groups/search?query=فيزياء&page=1&limit=20`
- **Auth**: `Bearer <TOKEN>`

---

### 4.2 Preview Group by Code
- **Method**: `GET`
- **URL**: `/api/v1/groups/preview/:groupCode`
- **Auth**: `Bearer <TOKEN>`

---

### 4.3 Join Group by Teacher Code
- **Method**: `POST`
- **URL**: `/api/v1/groups/join-by-code`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**: `{ "groupCode": "PHY-10-A" }`

---

### 4.4 Join Open Group Directly
- **Method**: `POST`
- **URL**: `/api/v1/groups/:groupId/join`
- **Auth**: `Bearer <TOKEN>`

---

### 4.5 Get My Enrolled Groups
- **Method**: `GET`
- **URL**: `/api/v1/groups/my-groups`
- **Auth**: `Bearer <TOKEN>`

---

## 5. Home Dashboard

### 5.1 Get Unified Student Home Feed
Single aggregated call delivering everything required on the mobile home screen.
- **Method**: `GET`
- **URL**: `/api/v1/home`
- **Auth**: `Bearer <TOKEN>`

---

## 6. Homework Engine

### 6.1 Get All Student Homework Feed (Pending / Completed)
- **Method**: `GET`
- **URL**: `/api/v1/homework?status=pending` (or `completed` or `all`)
- **Auth**: `Bearer <TOKEN>`

---

### 6.2 Get Homework Questions for Taking (MCQ & Essay)
- **Method**: `GET`
- **URL**: `/api/v1/homework/:homeworkId`
- **Auth**: `Bearer <TOKEN>`
- **Description**: Returns questions with choices and word limits. Correct answers are stripped for security.

---

### 6.3 Submit Homework Answers (Auto-grading & Speed Analytics)
- **Method**: `POST`
- **URL**: `/api/v1/homework/:homeworkId/submit`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**:
```json
{
  "answers": [
    { "questionOrder": 1, "selectedOption": 1, "timeSpentSeconds": 15 },
    { "questionOrder": 2, "selectedOption": 0, "timeSpentSeconds": 20 },
    { "questionOrder": 3, "essayText": "تطبيقات قوانين نيوتن تشمل حركة السيارات واستكشاف الفضاء...", "timeSpentSeconds": 60 }
  ],
  "timeAnalytics": {
    "averageTimePerQuestionSec": 31.6,
    "fastestQuestionSec": 15,
    "slowestQuestionSec": 60
  }
}
```

---

### 6.4 Get Homework Result Scorecard & Review
- **Method**: `GET`
- **URL**: `/api/v1/homework/:homeworkId/result`
- **Auth**: `Bearer <TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تقرير نتيجة الواجب ومراجعة الإجابات",
  "data": {
    "homeworkId": "hw-phys-01",
    "title": "حل مسائل الفصل الثاني - الحركة والقوة",
    "subjectName": "الفيزياء",
    "totalScoreObtained": 20,
    "totalScoreMax": 30,
    "correctCount": 2,
    "underReviewCount": 1,
    "wrongCount": 0,
    "percentileText": "أنت ضمن أعلى 20% من الطلاب",
    "timeAnalytics": {
      "averageTimePerQuestionSec": 31.6,
      "fastestQuestionSec": 15,
      "slowestQuestionSec": 60
    },
    "answersReview": [
      {
        "questionOrder": 1,
        "questionText": "ما هي وحدة قياس القوة في النظام الدولي؟",
        "selectedOption": 1,
        "correctOptionIndex": 1,
        "isCorrect": true,
        "scoreObtained": 10,
        "maxScore": 10
      }
    ]
  }
}
```

---

## 7. Exams & Quizzes Timed Engine

### 7.1 Get All Student Exams Feed
- **Method**: `GET`
- **URL**: `/api/v1/exams?tab=all` (or `available` or `completed` or `upcoming`)
- **Auth**: `Bearer <TOKEN>`

---

### 7.2 Get Exam Instructions & Guidelines
- **Method**: `GET`
- **URL**: `/api/v1/exams/:examId/instructions`
- **Auth**: `Bearer <TOKEN>`

---

### 7.3 Start Live Exam Session
- **Method**: `POST`
- **URL**: `/api/v1/exams/:examId/start`
- **Auth**: `Bearer <TOKEN>`

---

### 7.4 Submit Exam Answers & Palette Statuses
- **Method**: `POST`
- **URL**: `/api/v1/exams/:examId/submit`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**:
```json
{
  "answers": [
    { "questionOrder": 1, "selectedOption": 1, "paletteStatus": "ANSWERED", "timeSpentSeconds": 30 },
    { "questionOrder": 2, "selectedOption": 1, "paletteStatus": "ANSWERED", "timeSpentSeconds": 25 }
  ],
  "timeAnalytics": {
    "averageTimePerQuestionSec": 27.5,
    "fastestQuestionSec": 25,
    "slowestQuestionSec": 30
  }
}
```

---

### 7.5 Get Exam Report Card
- **Method**: `GET`
- **URL**: `/api/v1/exams/:examId/result`
- **Auth**: `Bearer <TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تقرير نتيجة الامتحان",
  "data": {
    "examId": "exam-phys-01",
    "title": "امتحان الفيزياء الأسبوعي",
    "subjectName": "الفيزياء",
    "totalScoreObtained": 90,
    "totalScoreMax": 100,
    "scorePercentage": 90,
    "passed": true,
    "correctCount": 9,
    "wrongCount": 1,
    "percentileBadge": "أنت ضمن أعلى 20% من الطلاب"
  }
}
```

---

## 8. Notifications

### 8.1 Get Notifications Feed
- **Method**: `GET`
- **URL**: `/api/v1/notifications?filter=all` (or `read` or `unread`)
- **Auth**: `Bearer <TOKEN>`

---

### 8.2 Get Notification Details
- **Method**: `GET`
- **URL**: `/api/v1/notifications/:id`
- **Auth**: `Bearer <TOKEN>`

---

### 8.3 Mark All as Read
- **Method**: `PATCH`
- **URL**: `/api/v1/notifications/read-all`
- **Auth**: `Bearer <TOKEN>`

---

### 8.4 Register Device Firebase Push Token (FCM)
- **Method**: `POST`
- **URL**: `/api/v1/notifications/fcm-token`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**: `{ "fcmToken": "sample_fcm_token_xyz" }`
