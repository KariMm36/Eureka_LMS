# 🎓 Eureka LMS — Backend REST API & Real-time Engine

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Vitest-260+_Tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/OpenAPI-3.0_Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Swagger" />
</p>

---

## 📖 Overview

**Eureka LMS** is a robust, modular, and scalable backend infrastructure powering an enterprise-grade Learning Management System. Designed for high availability and seamless cross-platform client integration (Mobile & Web), it caters to **Students**, **Teachers**, and **Platform Administrators** with role-based access control (RBAC), real-time messaging, automated grading, and live session management.

---

## 🌟 Key Features

### 🔐 1. Authentication & Security
* **JWT Access & Refresh Token Rotation**: Secure, short-lived access tokens with rotating refresh tokens stored securely in MySQL.
* **Instant Token Invalidation (`tokenVersion`)**: Atomic server-side revocation on logout — rejecting active JWTs instantly without heavy Redis blacklists.
* **Anti-Enumeration OTP Flows**: Secure 6-digit OTPs via email for registration confirmation and password reset.
* **Strict RBAC & Validation**: Layered role-based middleware (`STUDENT`, `TEACHER`, `ADMIN`, `SUPER_ADMIN`) and schema validation.

### 🎓 2. Student Experience
* **Academic Catalogue Discovery**: Educational stages, grade levels, subjects, units, and video/PDF lesson materials.
* **Home Dashboard & Feed**: Dynamic feed aggregating upcoming homework, timed exams, and teacher announcements.
* **Homework Engine**: MCQ auto-grading, essay minimum word count validation, scorecards, and peer percentile rankings.
* **Live Exam & Quiz Session**: Server-time window enforcement, randomized question presentation, answer submission, and comprehensive report cards.
* **Analytics & Gamification**: Learning streaks, attendance rate, completed assignments, and badge rewards.

### 👨‍🏫 3. Teacher Management Suite
* **Study Groups & Roster**: Group creation, QR code invite links, find-or-create student enrollment, and price/status adjustments.
* **Smart Attendance**: Dynamic QR roll-call and 6-digit session PINs with 10-minute TTL, manual batch roll-calls, and attendance dashboards.
* **Curriculum Authoring**: Full CRUD for subjects, units, lessons, and multimedia attachments (Cloudinary storage).
* **Homework & Exam Wizards**: Assignment authoring with deadlines, timed window exams, and question bank management.
* **Grading Queue & Financial Ledger**: Manual essay grading with student push feedback, student payment receipts, and revenue KPIs.

### 💬 4. Real-Time Communication & Push Center
* **1-on-1 Student & Teacher Chat**: Socket.IO WebSocket engine supporting direct messaging, persistent chat history, and unread badges.
* **FCM Push Notifications**: Firebase Cloud Messaging (FCM) integration delivering instant device notifications for assignments, exam grades, broadcasts, and chat.

### 🛡️ 5. Administrative Management Portal (33 Endpoints)
* **Macro KPI Dashboard**: Live platform counters (users, revenue, group registrations, active exams).
* **User Lifecycle & Moderation**: User search, role elevation, suspension/reactivation, forced session revocation, and direct password overrides.
* **Financial & Attendance Auditing**: Overdue payment tracking, at-risk attendance monitoring (<75%), and UTF-8 BOM CSV exports.
* **Global Multi-Channel Broadcast**: In-app + WebSocket + Push broadcast dispatching.
* **Immutable Audit Trail**: Structured event logging for all administrative operations.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|:---|:---|
| **Runtime & Framework** | Node.js (v20+), Express.js (ES Modules) |
| **Database & ORM** | MySQL 8.0, Prisma ORM |
| **Real-Time WebSockets** | Socket.IO |
| **Push Notifications** | Firebase Admin SDK (FCM) |
| **Media Storage** | Cloudinary / Local Disk Storage Fallback |
| **Documentation** | Swagger / OpenAPI 3.0, Postman Collection |
| **Testing Framework** | Vitest, Supertest (260+ automated integration tests) |
| **Security & Utilities** | Helmet, CORS, Bcrypt.js, JSON Web Tokens (JWT), Winston/Pino Logger |

---
---

## 🧪 Automated Testing

The codebase includes an extensive suite of **260+ end-to-end integration and adversarial audit tests**:

```bash
# Run all integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📚 API Documentation

* **Interactive Swagger UI**: `http://localhost:3000/api-docs` or [Live Swagger Documentation](https://eureka.growfet.com/api-docs)
* **Postman Collection**: Located in [`docs/eureka_lms.postman_collection.json`](docs/eureka_lms.postman_collection.json) featuring 115 requests with automated test assertions and dynamic role-based token captures.

