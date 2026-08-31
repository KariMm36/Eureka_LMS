-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    `avatarUrl` VARCHAR(255) NULL DEFAULT 'default-avatar.png',
    `appLanguage` VARCHAR(10) NOT NULL DEFAULT 'ar',
    `darkMode` BOOLEAN NOT NULL DEFAULT false,
    `notifyExams` BOOLEAN NOT NULL DEFAULT true,
    `notifySubjects` BOOLEAN NOT NULL DEFAULT true,
    `notifyHomework` BOOLEAN NOT NULL DEFAULT true,
    `notifyAnnouncements` BOOLEAN NOT NULL DEFAULT true,
    `fcmToken` TEXT NULL,
    `refreshTokenHash` VARCHAR(255) NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_role_isActive_createdAt_idx`(`role`, `isActive`, `createdAt`),
    INDEX `users_role_isVerified_createdAt_idx`(`role`, `isVerified`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otps` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `otpCode` VARCHAR(10) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isUsed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otps_email_type_isUsed_idx`(`email`, `type`, `isUsed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `parentPhone` VARCHAR(50) NULL,
    `stageId` VARCHAR(191) NULL,
    `gradeLevelId` VARCHAR(191) NULL,
    `isOnboardingCompleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_profiles_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stages` (
    `id` VARCHAR(191) NOT NULL,
    `key` ENUM('PRIMARY', 'PREPARATORY', 'SECONDARY') NOT NULL,
    `nameAr` VARCHAR(100) NOT NULL,
    `nameEn` VARCHAR(100) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `stages_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_levels` (
    `id` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(100) NOT NULL,
    `nameEn` VARCHAR(100) NOT NULL,
    `gradeNumber` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(100) NOT NULL,
    `nameEn` VARCHAR(100) NOT NULL,
    `iconUrl` VARCHAR(255) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `isGlobal` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_subjects` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `student_subjects_studentId_subjectId_key`(`studentId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `gradeLevelId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 1,
    `createdById` VARCHAR(191) NULL,

    INDEX `units_subjectId_gradeLevelId_idx`(`subjectId`, `gradeLevelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lessons` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 1,
    `createdById` VARCHAR(191) NULL,

    INDEX `lessons_unitId_order_idx`(`unitId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_videos` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `videoUrl` VARCHAR(255) NOT NULL,
    `durationSeconds` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `groupId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_materials` (
    `id` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(255) NOT NULL,
    `fileType` VARCHAR(20) NOT NULL DEFAULT 'PDF',
    `fileSizeBytes` INTEGER NULL,
    `createdById` VARCHAR(191) NULL,
    `groupId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `gradeLevelId` VARCHAR(191) NOT NULL,
    `groupCode` VARCHAR(50) NOT NULL,
    `scheduleDays` VARCHAR(191) NOT NULL,
    `scheduleTime` VARCHAR(50) NULL,
    `maxCapacity` INTEGER NOT NULL DEFAULT 50,
    `coverImageUrl` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `defaultPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `groups_groupCode_key`(`groupCode`),
    INDEX `groups_isActive_stageId_subjectId_idx`(`isActive`, `stageId`, `subjectId`),
    INDEX `groups_teacherId_isActive_createdAt_idx`(`teacherId`, `isActive`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_enrollments` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `enrollmentPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `addedBy` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `group_enrollments_groupId_status_idx`(`groupId`, `status`),
    UNIQUE INDEX `group_enrollments_groupId_studentId_key`(`groupId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homeworks` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `unitName` VARCHAR(191) NULL,
    `durationMinutes` INTEGER NOT NULL DEFAULT 30,
    `totalScore` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `homeworks_groupId_dueDate_idx`(`groupId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homework_questions` (
    `id` VARCHAR(191) NOT NULL,
    `homeworkId` VARCHAR(191) NOT NULL,
    `type` ENUM('MCQ', 'ESSAY') NOT NULL DEFAULT 'MCQ',
    `questionText` TEXT NOT NULL,
    `options` TEXT NULL,
    `correctOptionIndex` INTEGER NULL,
    `explanation` TEXT NULL,
    `modelAnswer` TEXT NULL,
    `minWords` INTEGER NOT NULL DEFAULT 0,
    `score` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 1,

    INDEX `homework_questions_homeworkId_order_idx`(`homeworkId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homework_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `homeworkId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `answersJson` TEXT NOT NULL,
    `totalScoreObtained` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `underReviewCount` INTEGER NOT NULL DEFAULT 0,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `percentileText` VARCHAR(100) NULL,
    `averageTimePerQuestionSec` DOUBLE NOT NULL DEFAULT 0,
    `fastestQuestionSec` DOUBLE NOT NULL DEFAULT 0,
    `slowestQuestionSec` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `homework_submissions_homeworkId_status_idx`(`homeworkId`, `status`),
    INDEX `homework_submissions_homeworkId_totalScoreObtained_idx`(`homeworkId`, `totalScoreObtained`),
    UNIQUE INDEX `homework_submissions_homeworkId_studentId_key`(`homeworkId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `lessonId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `passingScorePercentage` INTEGER NOT NULL DEFAULT 60,
    `guidelinesJson` TEXT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `totalScore` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exams_groupId_startTime_endTime_idx`(`groupId`, `startTime`, `endTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_questions` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `type` ENUM('MCQ', 'ESSAY') NOT NULL DEFAULT 'MCQ',
    `questionText` TEXT NOT NULL,
    `options` TEXT NULL,
    `correctOptionIndex` INTEGER NULL,
    `explanation` TEXT NULL,
    `modelAnswer` TEXT NULL,
    `minWords` INTEGER NOT NULL DEFAULT 0,
    `score` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 1,

    INDEX `exam_questions_examId_order_idx`(`examId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `examId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `answersJson` TEXT NOT NULL,
    `totalScoreObtained` INTEGER NOT NULL DEFAULT 0,
    `scorePercentage` DOUBLE NOT NULL DEFAULT 0,
    `passed` BOOLEAN NOT NULL DEFAULT false,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `underReviewCount` INTEGER NOT NULL DEFAULT 0,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `averageTimePerQuestionSec` DOUBLE NOT NULL DEFAULT 0,
    `fastestQuestionSec` DOUBLE NOT NULL DEFAULT 0,
    `slowestQuestionSec` DOUBLE NOT NULL DEFAULT 0,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exam_submissions_examId_scorePercentage_idx`(`examId`, `scorePercentage`),
    INDEX `exam_submissions_examId_totalScoreObtained_idx`(`examId`, `totalScoreObtained`),
    UNIQUE INDEX `exam_submissions_examId_studentId_key`(`examId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sessionDate` DATETIME(3) NOT NULL,
    `qrToken` VARCHAR(100) NULL,
    `sessionCode` VARCHAR(20) NULL,
    `qrExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `class_sessions_qrToken_key`(`qrToken`),
    UNIQUE INDEX `class_sessions_sessionCode_key`(`sessionCode`),
    INDEX `class_sessions_groupId_sessionDate_idx`(`groupId`, `sessionDate`),
    INDEX `class_sessions_sessionCode_idx`(`sessionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendances_sessionId_status_idx`(`sessionId`, `status`),
    UNIQUE INDEX `attendances_sessionId_studentId_key`(`sessionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_payments` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `paymentMethod` VARCHAR(50) NOT NULL,
    `monthLabel` VARCHAR(50) NOT NULL,
    `receiptUrl` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `student_payments_teacherId_paidAt_idx`(`teacherId`, `paidAt`),
    INDEX `student_payments_teacherId_groupId_monthLabel_idx`(`teacherId`, `groupId`, `monthLabel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `type` ENUM('LESSON', 'EXAM', 'HOMEWORK', 'ANNOUNCEMENT') NOT NULL DEFAULT 'ANNOUNCEMENT',
    `referenceId` VARCHAR(191) NULL,
    `attachments` TEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_isRead_createdAt_idx`(`userId`, `isRead`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `lastMessage` TEXT NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `unreadByTeacher` INTEGER NOT NULL DEFAULT 0,
    `unreadByStudent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `conversations_teacherId_lastMessageAt_idx`(`teacherId`, `lastMessageAt`),
    INDEX `conversations_studentId_lastMessageAt_idx`(`studentId`, `lastMessageAt`),
    UNIQUE INDEX `conversations_groupId_studentId_teacherId_key`(`groupId`, `studentId`, `teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `senderRole` ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL,
    `content` TEXT NOT NULL,
    `attachmentUrl` VARCHAR(255) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_messages_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `resource` VARCHAR(50) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_adminId_createdAt_idx`(`adminId`, `createdAt`),
    INDEX `audit_logs_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `audit_logs_resource_resourceId_idx`(`resource`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `maintenanceMode` BOOLEAN NOT NULL DEFAULT false,
    `registrationOpen` BOOLEAN NOT NULL DEFAULT true,
    `supportEmail` VARCHAR(191) NULL DEFAULT 'support@eureka-lms.com',
    `supportPhone` VARCHAR(50) NULL DEFAULT '+201000000000',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `otps` ADD CONSTRAINT `otps_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `stages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_gradeLevelId_fkey` FOREIGN KEY (`gradeLevelId`) REFERENCES `grade_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_levels` ADD CONSTRAINT `grade_levels_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `stages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_subjects` ADD CONSTRAINT `student_subjects_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_subjects` ADD CONSTRAINT `student_subjects_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_gradeLevelId_fkey` FOREIGN KEY (`gradeLevelId`) REFERENCES `grade_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_videos` ADD CONSTRAINT `lesson_videos_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_videos` ADD CONSTRAINT `lesson_videos_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_videos` ADD CONSTRAINT `lesson_videos_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_materials` ADD CONSTRAINT `lesson_materials_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_materials` ADD CONSTRAINT `lesson_materials_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_materials` ADD CONSTRAINT `lesson_materials_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_gradeLevelId_fkey` FOREIGN KEY (`gradeLevelId`) REFERENCES `grade_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_enrollments` ADD CONSTRAINT `group_enrollments_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_enrollments` ADD CONSTRAINT `group_enrollments_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homeworks` ADD CONSTRAINT `homeworks_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homeworks` ADD CONSTRAINT `homeworks_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homeworks` ADD CONSTRAINT `homeworks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework_questions` ADD CONSTRAINT `homework_questions_homeworkId_fkey` FOREIGN KEY (`homeworkId`) REFERENCES `homeworks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_homeworkId_fkey` FOREIGN KEY (`homeworkId`) REFERENCES `homeworks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homework_submissions` ADD CONSTRAINT `homework_submissions_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `lessons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_submissions` ADD CONSTRAINT `exam_submissions_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_submissions` ADD CONSTRAINT `exam_submissions_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_sessions` ADD CONSTRAINT `class_sessions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `class_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_payments` ADD CONSTRAINT `student_payments_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_payments` ADD CONSTRAINT `student_payments_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `student_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_payments` ADD CONSTRAINT `student_payments_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

