import bcrypt from 'bcryptjs';
import prisma from '../../src/config/prisma.js';
import { signToken, signRefreshToken, hashRefreshToken } from '../../src/utils/jwt.util.js';

/**
 * Shared Test Fixture Generator & Teardown Helper for Vitest
 */
export class TestSetupHelper {
  constructor(prefix = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`) {
    this.prefix = prefix;
    this.createdUserIds = new Set();
    this.createdGroupIds = new Set();
    this.createdHomeworkIds = new Set();
    this.createdExamIds = new Set();
    this.createdUnitIds = new Set();
    this.createdLessonIds = new Set();
    this.createdSubjectIds = new Set();
    this.createdAcademicIds = {
      stageId: null,
      gradeLevelId: null,
      subjectId: null,
      unitId: null,
      lessonId: null,
    };
  }

  /**
   * 1. Get or Create Baseline Academic Structure (Stage -> GradeLevel -> Subject -> Unit -> Lesson)
   */
  async createAcademicHierarchy() {
    // 1. Stage (Fetch existing or create)
    let stage = await prisma.stage.findFirst({
      where: { key: 'SECONDARY' },
    });
    if (!stage) {
      stage = await prisma.stage.create({
        data: {
          key: 'SECONDARY',
          nameAr: 'المرحلة الثانوية',
          nameEn: 'Secondary Stage',
          order: 3,
        },
      });
    }
    this.createdAcademicIds.stageId = stage.id;

    // 2. Grade Level (Fetch existing or create)
    let gradeLevel = await prisma.gradeLevel.findFirst({
      where: { stageId: stage.id },
    });
    if (!gradeLevel) {
      gradeLevel = await prisma.gradeLevel.create({
        data: {
          stageId: stage.id,
          nameAr: 'الصف الأول الثانوي',
          nameEn: 'Grade 10',
          order: 1,
        },
      });
    }
    this.createdAcademicIds.gradeLevelId = gradeLevel.id;

    // 3. Subject (Create unique for this test suite)
    const subject = await prisma.subject.create({
      data: {
        nameAr: `فيزياء تجريبية ${this.prefix}`,
        nameEn: `Test Physics ${this.prefix}`,
        iconUrl: 'https://example.com/icon.png',
      },
    });
    this.createdAcademicIds.subjectId = subject.id;
    this.createdSubjectIds.add(subject.id);

    // 4. Unit
    const unit = await prisma.unit.create({
      data: {
        title: `الوحدة الأولى: الميكانيكا ${this.prefix}`,
        order: 1,
        subjectId: subject.id,
        gradeLevelId: gradeLevel.id,
      },
    });
    this.createdAcademicIds.unitId = unit.id;
    this.createdUnitIds.add(unit.id);

    // 5. Lesson
    const lesson = await prisma.lesson.create({
      data: {
        unitId: unit.id,
        title: `الدرس الأول: الحركة والقوى ${this.prefix}`,
        order: 1,
      },
    });
    this.createdAcademicIds.lessonId = lesson.id;
    this.createdLessonIds.add(lesson.id);

    return {
      stage,
      gradeLevel,
      subject,
      unit,
      lesson,
    };
  }

  /**
   * 2. Create a Test User (Student, Teacher, Admin)
   */
  async createUser({ role = 'STUDENT', email, phone, fullName, password = 'Password123!', isVerified = true } = {}) {
    if (!this.createdAcademicIds.stageId) {
      await this.createAcademicHierarchy();
    }

    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const userEmail = (email || `${this.prefix}_${role.toLowerCase()}_${timestamp}@eureka-test.com`).toLowerCase();
    const userPhone = phone || `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const userFullName = fullName || `مستخدم تجريبي ${role} ${this.prefix}`;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email: userEmail,
        phone: userPhone,
        fullName: userFullName,
        password: passwordHash,
        role,
        isVerified,
        ...(role === 'STUDENT' && {
          studentProfile: {
            create: {
              stageId: this.createdAcademicIds.stageId,
              gradeLevelId: this.createdAcademicIds.gradeLevelId,
            },
          },
        }),
      },
      include: {
        studentProfile: true,
      },
    });

    this.createdUserIds.add(user.id);

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id });

    // Store hashed refresh token
    const refreshTokenHash = await bcrypt.hash(hashRefreshToken(refreshToken), 8);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      user,
      token,
      refreshToken,
      rawPassword: password,
    };
  }

  async createStudent(options = {}) {
    return this.createUser({ role: 'STUDENT', ...options });
  }

  async createTeacher(options = {}) {
    return this.createUser({ role: 'TEACHER', ...options });
  }

  /**
   * 3. Create a Group with Teacher & Academic links
   */
  async createGroup({ teacherId, maxCapacity = 50, groupCode, defaultPrice = 0 } = {}) {
    if (!this.createdAcademicIds.subjectId) {
      await this.createAcademicHierarchy();
    }

    let assignedTeacherId = teacherId;
    if (!assignedTeacherId) {
      const teacher = await this.createUser({ role: 'TEACHER' });
      assignedTeacherId = teacher.user.id;
    }

    const randomSuffix = `${Date.now().toString().slice(-6)}_${Math.floor(1000 + Math.random() * 9000)}`;
    const code = (groupCode || `GRP_${this.prefix.slice(-4)}_${randomSuffix}`).toUpperCase();

    const group = await prisma.group.create({
      data: {
        name: `مجموعة تجريبية ${this.prefix}`,
        groupCode: code,
        teacherId: assignedTeacherId,
        subjectId: this.createdAcademicIds.subjectId,
        stageId: this.createdAcademicIds.stageId,
        gradeLevelId: this.createdAcademicIds.gradeLevelId,
        scheduleDays: 'الأحد,الثلاثاء,الخميس',
        scheduleTime: '05:00 PM',
        maxCapacity,
        defaultPrice,
        isActive: true,
      },
      include: {
        teacher: true,
        subject: true,
        stage: true,
        gradeLevel: true,
      },
    });

    this.createdGroupIds.add(group.id);
    return group;
  }

  /**
   * 4. Enroll Student in Group
   */
  async enrollStudent(studentProfileId, groupId, status = 'ACTIVE', enrollmentPrice = 0) {
    return prisma.groupEnrollment.create({
      data: {
        studentId: studentProfileId,
        groupId,
        status,
        enrollmentPrice,
      },
    });
  }

  /**
   * 5. Create Homework with MCQ and Essay Questions
   */
  async createHomework({ groupId, lessonId, totalScore = 20, minWords = 10 } = {}) {
    if (!this.createdAcademicIds.lessonId) {
      await this.createAcademicHierarchy();
    }

    let targetGroupId = groupId;
    if (!targetGroupId) {
      const group = await this.createGroup();
      targetGroupId = group.id;
    }

    const homework = await prisma.homework.create({
      data: {
        title: `واجب تجريبي ${this.prefix}`,
        lessonId: lessonId || this.createdAcademicIds.lessonId,
        groupId: targetGroupId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
        totalScore,
        questions: {
          create: [
            {
              questionText: 'ما هي وحدة قياس القوة في النظام الدولي؟',
              type: 'MCQ',
              options: JSON.stringify(['نيوتن', 'جول', 'واط', 'باسكال']),
              correctOptionIndex: 0,
              score: 10,
              order: 1,
            },
            {
              questionText: 'اشرح قانون نيوتن الأول للحركة مع ذكر مثال عملي من الحياة اليومية.',
              type: 'ESSAY',
              minWords, // Configurable minimum words
              score: 10,
              order: 2,
            },

          ],
        },
      },
      include: {
        questions: true,
        group: { include: { subject: true } },
      },
    });

    this.createdHomeworkIds.add(homework.id);
    return homework;
  }

  /**
   * 6. Create Exam with Window Constraints (Active, Future, or Past)
   */
  async createExam({ groupId, lessonId, windowType = 'ACTIVE', durationMinutes = 30, totalScore = 30, minWords = 15 } = {}) {
    if (!this.createdAcademicIds.lessonId) {
      await this.createAcademicHierarchy();
    }

    let targetGroupId = groupId;
    if (!targetGroupId) {
      const group = await this.createGroup();
      targetGroupId = group.id;
    }

    const now = Date.now();
    let startTime, endTime;

    if (windowType === 'ACTIVE') {
      startTime = new Date(now - 10 * 60 * 1000); // Started 10 mins ago
      endTime = new Date(now + 60 * 60 * 1000);   // Ends in 60 mins
    } else if (windowType === 'FUTURE') {
      startTime = new Date(now + 24 * 60 * 60 * 1000); // Starts tomorrow
      endTime = new Date(now + 26 * 60 * 60 * 1000);
    } else if (windowType === 'PAST') {
      startTime = new Date(now - 48 * 60 * 60 * 1000); // Ended yesterday
      endTime = new Date(now - 24 * 60 * 60 * 1000);
    }

    const exam = await prisma.exam.create({
      data: {
        title: `امتحان تجريبي (${windowType}) ${this.prefix}`,
        lessonId: lessonId || this.createdAcademicIds.lessonId,
        groupId: targetGroupId,
        startTime,
        endTime,
        durationMinutes,
        totalScore,
        questions: {
          create: [
            {
              questionText: 'ما هو تسارع الجاذبية الأرضية تقريباً؟',
              type: 'MCQ',
              options: JSON.stringify(['9.8 م/ث²', '3.14 م/ث²', '100 م/ث²', '0 م/ث²']),
              correctOptionIndex: 0,
              explanation: 'تسارع الجاذبية الأرضية = 9.8 م/ث²',
              score: 15,
              order: 1,
            },
            {
              questionText: 'ناقش أثر مقاومة الهواء على سقوط الأجسام المختلفة في الفراغ.',
              type: 'ESSAY',
              minWords,
              score: 15,
              order: 2,
            },
          ],
        },
      },
      include: {
        questions: true,
        group: { include: { subject: true } },
      },
    });

    this.createdExamIds.add(exam.id);
    return exam;
  }

  /**
   * 7. Create Multiple Students with Varying Scores for Peer Percentile & Ranking Tests
   */
  async createGroupWithRankedStudents(groupId, homeworkId) {
    const studentData = [
      { score: 95, correct: 10, wrong: 0, percentileBadge: 'أنت ضمن أعلى 10% من الطلاب 🥇' },
      { score: 80, correct: 8, wrong: 2, percentileBadge: 'أنت ضمن أعلى 25% من الطلاب 🥈' },
      { score: 60, correct: 6, wrong: 4, percentileBadge: 'أنت ضمن أعلى 50% من الطلاب 🥉' },
      { score: 30, correct: 3, wrong: 7, percentileBadge: 'واصل المحاولة لتحسين ترتيبك' },
    ];

    const createdStudents = [];

    for (let i = 0; i < studentData.length; i++) {
      const data = studentData[i];
      const student = await this.createUser({ fullName: `طالب مرتبة ${i + 1} ${this.prefix}` });
      await this.enrollStudent(student.user.studentProfile.id, groupId);

      // Create prior submission for ranking comparison
      if (homeworkId) {
        await prisma.homeworkSubmission.create({
          data: {
            homeworkId,
            studentId: student.user.studentProfile.id,
            answersJson: JSON.stringify([]),
            totalScoreObtained: data.score,
            correctCount: data.correct,
            wrongCount: data.wrong,
            underReviewCount: 0,
            percentileText: data.percentileBadge,
            status: 'GRADED',
          },
        });
      }

      createdStudents.push({ ...student, expectedScore: data.score });
    }

    return createdStudents;
  }

  /**
   * 8. Clean up all created test records in safe cascade order
   */
  async cleanup() {
    try {
      // 1. Delete Exams & Submissions
      if (this.createdExamIds.size > 0) {
        await prisma.exam.deleteMany({
          where: { id: { in: Array.from(this.createdExamIds) } },
        });
      }

      // 2. Delete Homeworks & Submissions
      if (this.createdHomeworkIds.size > 0) {
        await prisma.homework.deleteMany({
          where: { id: { in: Array.from(this.createdHomeworkIds) } },
        });
      }

      // 3. Delete Payments, Class Sessions, Conversations, Chat Messages, Group Enrollments & Groups
      if (this.createdGroupIds.size > 0) {
        const groupIds = Array.from(this.createdGroupIds);
        await prisma.chatMessage.deleteMany({ where: { conversation: { groupId: { in: groupIds } } } });
        await prisma.conversation.deleteMany({ where: { groupId: { in: groupIds } } });
        await prisma.studentPayment.deleteMany({ where: { groupId: { in: groupIds } } });
        await prisma.attendance.deleteMany({ where: { session: { groupId: { in: groupIds } } } });
        await prisma.classSession.deleteMany({ where: { groupId: { in: groupIds } } });
        await prisma.groupEnrollment.deleteMany({ where: { groupId: { in: groupIds } } });
        await prisma.group.deleteMany({
          where: { id: { in: groupIds } },
        });
      }

      // 4. Delete Users, Profiles, OTPs, Notifications
      if (this.createdUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: Array.from(this.createdUserIds) } },
        });
      }

      // 5. Delete Academic Hierarchy (Lessons, Units, Subjects)
      if (this.createdLessonIds.size > 0) {
        await prisma.lesson.deleteMany({
          where: { id: { in: Array.from(this.createdLessonIds) } },
        });
      }
      if (this.createdUnitIds.size > 0) {
        await prisma.unit.deleteMany({
          where: { id: { in: Array.from(this.createdUnitIds) } },
        });
      }
      if (this.createdSubjectIds.size > 0) {
        await prisma.subject.deleteMany({
          where: { id: { in: Array.from(this.createdSubjectIds) } },
        });
      }
    } catch (err) {
      console.warn(`[TestSetup Cleanup Warning for ${this.prefix}]:`, err.message);
    }
  }
}
