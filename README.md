# 🎓 Eureka LMS — Backend REST API & Real-Time Engine

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Vitest-262_Passed_Tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/OpenAPI-3.0_Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Swagger" />
</p>

---

## 🎨 UI/UX Design System (Figma)

The complete UI/UX and mobile application design system for Eureka LMS is available on Figma:

👉 **[Figma Design — Eureka Educational Platform](https://www.figma.com/design/I68orVLtxS3f3T4fjBetGy/Eureka-Educational-Platform?node-id=2-4&p=f&t=yuCk2ItBeSa3tEw5-0)**

---

## 🔑 Demo & Portal Test Accounts

Pre-configured, fully functional user accounts for all three portals on the live production server:

| Portal Role | Email | Password | Scope & Privileges |
| :--- | :--- | :--- | :--- |
| 👑 **Admin Portal** | `admin@eureka.com` | `Admin@SecurePass2026!` | Full platform management, macro KPIs, user moderation, finance ledgers, system settings & global broadcasts |
| 👨‍🏫 **Teacher Portal** | `Tarek2@gmail.com` | `Password123!` | Groups management, curriculum authoring, timed exams & homework wizards, essay grading queue, financial tracking & QR attendance |
| 🎓 **Student Portal** | `kareeem.mmustafa@gmail.com` | `Password123!` | Group discovery, live exam taking, homework submissions with instant auto-grading, peer percentiles & 1-on-1 chat |

> **Live Base URL**: `https://eureka.growfet.com/api/v1`  
> **Swagger API Docs**: `https://eureka.growfet.com/api-docs`

---

## 🚀 Quick Tour of Eureka LMS

**Eureka LMS** is an enterprise-grade backend infrastructure built with **Node.js**, **Express.js (ES Modules)**, **Prisma ORM**, **MySQL**, and **Socket.IO**. It powers a dual-audience educational platform with strict Role-Based Access Control (RBAC), concurrency safeguards, dynamic KPI calculations, and real-time events.

```mermaid
graph TD
    Client[Web & Mobile Clients]
    Gateway[Express Gateway / IIS Reverse Proxy]
    Auth[JWT & RBAC Security Layer]
    
    subgraph "Core Business Services"
        AdminModule[Admin Oversight & Moderation]
        TeacherModule[Teacher Suite & Curriculum]
        StudentModule[Student Learning & Feed]
        ChatModule[1-on-1 Realtime Chat]
        ExamModule[Exams & Homework Auto-Grading]
    end

    subgraph "Data & Realtime Layer"
        MySQL[(MySQL 8.0 / Prisma ORM)]
        SocketIO[Socket.IO Server]
        FCM[Firebase Cloud Messaging]
    end

    Client --> Gateway
    Gateway --> Auth
    Auth --> AdminModule
    Auth --> TeacherModule
    Auth --> StudentModule
    Auth --> ChatModule
    Auth --> ExamModule

    AdminModule --> MySQL
    TeacherModule --> MySQL
    StudentModule --> MySQL
    ExamModule --> MySQL
    ChatModule --> MySQL
    ChatModule --> SocketIO
    TeacherModule --> FCM
    AdminModule --> FCM
```

---

### 🌟 Key Functional Highlights

#### 1. 🔐 Zero-Leak Authentication & Anti-Enumeration
* **JWT Access & Refresh Token Rotation**: Short-lived access tokens with SHA-256 pre-hashed rotating refresh tokens.
* **Instant Token Invalidation (`tokenVersion`)**: Logging out increments the user's `tokenVersion`, immediately revoking all issued access tokens without heavy Redis blacklists.
* **Anti-Enumeration OTP Flows**: OTP-based verification and password resets return uniform response times and payloads to prevent account probing.

#### 2. 👨‍🏫 Teacher Management & Authoring Suite
* **Real-Time Dynamic KPIs**: Revenue, group growth, and student retention rates calculated dynamically from database timestamps without mock numbers.
* **Curriculum & Media Engine**: Full CRUD for educational stages, grades, subjects, units, lessons, and multimedia attachments.
* **Assessment Wizards**: Timed window exams and homework creation supporting both auto-graded MCQs and manual-review essay questions.
* **Smart Roll-Call**: Live dynamic QR codes and 6-digit session PINs with a 10-minute TTL, batch manual roll-calls, and attendance rate calculations.

#### 3. 🎓 Student Experience & Assessment Engine
* **Consolidated Dashboard**: Personalized feed aggregating today's lectures, homework deadlines, upcoming exams, and unread notifications.
* **Group Discovery & Atomic Joining**: Group join-by-code utilizing **`FOR UPDATE` row-level locks** to guarantee `maxCapacity` is never breached during concurrent registrations.
* **Server-Time Enforced Exams**: Submissions validated against server UTC time with automated grading, essay minimum word count checks, and peer percentiles calculated against actual cohorts.

#### 4. 💬 Real-Time Chat & Multi-Channel Push
* **1-on-1 Student ↔ Teacher Messaging**: Socket.IO bidirectional communications with JWT handshake authentication, automatic `user:{userId}` personal room routing, and atomic unread count tracking.
* **Firebase Cloud Messaging (FCM)**: Batched multicasting (500-token chunk limits) for assignment alerts, exam grading notices, and system announcements.

#### 5. 🛡️ Administrative Portal
* **Macro KPIs & Auditing**: Platform-wide revenue summary, registered students, active groups, at-risk attendance monitoring, and structured audit logs.
* **User Lifecycle Moderation**: Role elevation, account activation/suspension, and UTF-8 BOM CSV financial exports.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Runtime & Framework** | Node.js 20.x, Express.js (ES Modules) |
| **Database & ORM** | MySQL 8.0, Prisma ORM |
| **Real-Time WebSockets** | Socket.IO 4.x |
| **Push Notifications** | Firebase Admin SDK (FCM Multicast) |
| **File Storage** | Cloudinary / Local Disk Storage Fallback |
| **Testing Suite** | Vitest, Supertest (262 integration & security tests) |
| **Security & Standards** | Helmet, CORS, Bcrypt.js, JSON Web Tokens (JWT), Joi Validation, Winston Logger |

---

## 💻 Local Development Setup

### 1. Prerequisites
* Node.js `>= 20.0.0`
* MySQL `>= 8.0`

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Growfet/eureka__nodejs.git
cd eureka__nodejs

# Install dependencies
npm ci
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="mysql://root:password@localhost:3306/eureka_db"

JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
JWT_REFRESH_EXPIRES_IN="7d"

CORS_ORIGINS="http://localhost:3000,http://localhost:5173,http://localhost:19006"
```

### 4. Database Setup & Seeding
```bash
# Apply Prisma migrations
npx prisma migrate dev

# Seed stages, grades, subjects, and initial admin account
npx prisma db seed
```

### 5. Running the Application
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

---

## 🧪 Automated Testing

The project is backed by **262 automated integration and security tests** across 26 test suites:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📚 API Documentation & Postman

* **Interactive Swagger UI**: Accessible locally at `http://localhost:3000/api-docs` or on the [Live Server](https://eureka.growfet.com/api-docs).
* **Postman Collection**: Pre-configured collection with automatic token extraction and environment variables located in [`docs/eureka_lms.postman_collection.json`](docs/eureka_lms.postman_collection.json).
