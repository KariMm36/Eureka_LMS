# 📖 Eureka LMS - REST API Reference

- **Base URL**: `http://localhost:5000/api/v1`
- **Interactive Swagger Docs**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **Authentication**: `Authorization: Bearer <JWT_TOKEN>`

---

## 📑 Table of Contents
1. [Authentication (`/auth`)](#1-authentication)
2. [Academic Catalogue (`/academic`)](#2-academic-catalogue)
3. [Student Profile & Settings (`/students`)](#3-student-profile--settings)
4. [Groups & Enrollment (`/groups`)](#4-groups--enrollment)
5. [Home Dashboard Aggregator (`/home`)](#5-home-dashboard)
6. [Notifications (`/notifications`)](#6-notifications)

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
      "role": "STUDENT",
      "studentProfile": { "id": "profile-uuid" }
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
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم تسجيل الدخول بنجاح",
  "data": {
    "user": {
      "id": "user-uuid",
      "fullName": "أحمد عماد محمد",
      "email": "student@eureka.com",
      "role": "STUDENT"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.3 Forgot Password (Request OTP)
Generates a 6-digit OTP code with a 10-minute expiry and delivers it to the user's email inbox.
- **Method**: `POST`
- **URL**: `/api/v1/auth/forgot-password`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "student@eureka.com"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح",
  "data": {
    "email": "student@eureka.com",
    "expiresInMinutes": 10
  }
}
```

---

### 1.4 Verify OTP Code
- **Method**: `POST`
- **URL**: `/api/v1/auth/verify-otp`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "student@eureka.com",
  "otpCode": "584920"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم التحقق من الرمز بنجاح",
  "data": {
    "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.5 Reset Password
- **Method**: `POST`
- **URL**: `/api/v1/auth/reset-password`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "student@eureka.com",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewPassword@123",
  "confirmPassword": "NewPassword@123"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تمت إعادة تعيين كلمة المرور بنجاح"
}
```

---

### 1.6 Update Password (Logged-In User)
- **Method**: `PUT`
- **URL**: `/api/v1/auth/update-password`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**:
```json
{
  "currentPassword": "Password@123",
  "newPassword": "NewPassword@123",
  "confirmPassword": "NewPassword@123"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم تحديث كلمة المرور بنجاح"
}
```

---

### 1.7 Get Current Authenticated Profile
- **Method**: `GET`
- **URL**: `/api/v1/auth/me`
- **Auth**: `Bearer <TOKEN>`
- **Success Response (`200 OK`)**: Returns current user object.

---

## 2. Academic Catalogue

### 2.1 Get Educational Stages & Grades
Returns Primary, Preparatory, and Secondary stages with grade levels (served from high-speed in-memory cache in 1ms).
- **Method**: `GET`
- **URL**: `/api/v1/academic/stages`
- **Auth**: None
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "قائمة المراحل والصفوف الدراسية",
  "data": [
    {
      "id": "stage-primary",
      "nameAr": "المرحلة الابتدائية",
      "key": "PRIMARY",
      "grades": [
        { "id": "grade-1", "nameAr": "الصف الأول الابتدائي", "gradeNumber": 1 },
        { "id": "grade-6", "nameAr": "الصف السادس الابتدائي", "gradeNumber": 6 }
      ]
    },
    {
      "id": "stage-prep",
      "nameAr": "المرحلة الإعدادية",
      "key": "PREPARATORY",
      "grades": [
        { "id": "grade-7", "nameAr": "الصف الأول الإعدادي", "gradeNumber": 7 }
      ]
    },
    {
      "id": "stage-sec",
      "nameAr": "المرحلة الثانوية",
      "key": "SECONDARY",
      "grades": [
        { "id": "grade-10", "nameAr": "الصف الأول الثانوي", "gradeNumber": 10 }
      ]
    }
  ]
}
```

---

### 2.2 Get Core Subjects List
- **Method**: `GET`
- **URL**: `/api/v1/academic/subjects`
- **Query Params**: `gradeLevelId` (optional)
- **Auth**: None
- **Success Response (`200 OK`)**: Returns array of subjects with icon URLs.

---

### 2.3 Get Subject Units & Lessons
- **Method**: `GET`
- **URL**: `/api/v1/academic/subjects/:subjectId/topics`
- **Auth**: None
- **Success Response (`200 OK`)**: Returns curriculum units, ordered lessons, video stream links, and attached PDFs.

---

### 2.4 Get Lesson Details
- **Method**: `GET`
- **URL**: `/api/v1/academic/lessons/:lessonId`
- **Auth**: None
- **Success Response (`200 OK`)**: Returns full lesson info with streaming links, downloadable summary PDFs, and linked quiz/homework IDs.

---

## 3. Student Profile & Settings

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
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم إكمال بيانات الطالب واختيار المواد بنجاح"
}
```

---

### 3.2 Get Student Profile
- **Method**: `GET`
- **URL**: `/api/v1/students/profile`
- **Auth**: `Bearer <TOKEN>`
- **Success Response (`200 OK`)**: Returns stage, grade, parent phone, selected subjects, and active group enrollments.

---

### 3.3 Update Personal Profile & Avatar
- **Method**: `PUT`
- **URL**: `/api/v1/students/profile`
- **Auth**: `Bearer <TOKEN>`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `fullName` (string)
  - `phone` (string)
  - `parentPhone` (string)
  - `gradeLevelId` (string)
  - `avatar` (file - Max 5MB JPG/PNG/WEBP)
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم تحديث الملف الشخصي بنجاح"
}
```

---

### 3.4 Update App Settings
- **Method**: `PUT`
- **URL**: `/api/v1/students/settings`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**:
```json
{
  "appLanguage": "ar",
  "darkMode": true,
  "notifyExams": true,
  "notifySubjects": true,
  "notifyHomework": true,
  "notifyAnnouncements": true
}
```

---

## 4. Groups & Enrollment

### 4.1 Search & Browse Groups (Paginated)
- **Method**: `GET`
- **URL**: `/api/v1/groups/search?query=فيزياء&page=1&limit=20`
- **Auth**: `Bearer <TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "نتائج البحث عن المجموعات",
  "data": {
    "pagination": {
      "totalCount": 4,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1,
      "hasNextPage": false
    },
    "groups": [
      {
        "id": "grp-phy-10",
        "name": "مجموعة الفيزياء - الصف الأول الثانوي (أ)",
        "groupCode": "PHY-10-A",
        "scheduleDays": ["الأحد", "الثلاثاء", "الخميس"],
        "scheduleTime": "05:00 PM",
        "studentCount": 18,
        "maxCapacity": 50,
        "isFull": false,
        "teacher": { "fullName": "أ/ أحمد محمد" },
        "subject": { "nameAr": "الفيزياء" }
      }
    ]
  }
}
```

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
- **Request Body**:
```json
{
  "groupCode": "PHY-10-A"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم الانضمام بنجاح إلى مجموعة الفيزياء - الصف الأول الثانوي (أ)"
}
```

---

### 4.4 Join Open Group Directly (Without Code)
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
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "بيانات الصفحة الرئيسية للطالب",
  "data": {
    "student": {
      "fullName": "أحمد عماد محمد",
      "greeting": "مرحباً بك يا أحمد 👋",
      "gradeName": "الصف السادس الابتدائي",
      "stageName": "المرحلة الابتدائية"
    },
    "unreadNotificationsCount": 3,
    "nextClass": {
      "subjectName": "الرياضيات",
      "teacherName": "أ/ محمد علي",
      "time": "04:30 PM",
      "status": "NEXT"
    },
    "todaySchedule": [
      {
        "id": "math-slot-1",
        "subjectName": "الرياضيات",
        "teacherName": "أ/ محمد علي",
        "time": "04:30 PM - 06:00 PM",
        "isCurrent": true
      }
    ],
    "pendingHomework": [
      {
        "id": "hw-1",
        "title": "حل مسائل الجبر - صفحة 45",
        "subjectName": "الرياضيات",
        "dueText": "ينتهي غداً"
      }
    ],
    "upcomingExams": [
      {
        "id": "exam-1",
        "title": "امتحان نصف الترم - الرياضيات",
        "subjectName": "الرياضيات",
        "countdownText": "يبدأ بعد 02:45:00"
      }
    ]
  }
}
```

---

## 6. Notifications

### 6.1 Get Notifications Feed
- **Method**: `GET`
- **URL**: `/api/v1/notifications?filter=all` (or `read` or `unread`)
- **Auth**: `Bearer <TOKEN>`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "قائمة الإشعارات",
  "data": {
    "unreadCount": 2,
    "notifications": [
      {
        "id": "notif-1",
        "title": "تمت إضافة درس جديد في مادة الفيزياء",
        "body": "قام أ/ أحمد محمد بإضافة شرح وحل مسائل على قوانين الحركة.",
        "type": "NEW_LESSON",
        "referenceId": "lesson-phys-02",
        "isRead": false,
        "createdAt": "2026-08-23T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 6.2 Get Notification Details
- **Method**: `GET`
- **URL**: `/api/v1/notifications/:id`
- **Auth**: `Bearer <TOKEN>`

---

### 6.3 Mark All as Read
- **Method**: `PATCH`
- **URL**: `/api/v1/notifications/read-all`
- **Auth**: `Bearer <TOKEN>`

---

### 6.4 Register Device Firebase FCM Push Token
- **Method**: `POST`
- **URL**: `/api/v1/notifications/fcm-token`
- **Auth**: `Bearer <TOKEN>`
- **Request Body**:
```json
{
  "fcmToken": "sample_fcm_device_token_xyz"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "تم تحديث رمز الإشعارات بنجاح"
}
```
