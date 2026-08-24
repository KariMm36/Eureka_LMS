import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export class StudentService {
  static async completeOnboarding(userId, { stageId, gradeLevelId, selectedSubjectIds, subjectIds, parentPhone }) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const finalSubjectIds = selectedSubjectIds || subjectIds || [];

    // Verify Stage & GradeLevel exist
    const stage = await prisma.stage.findUnique({ where: { id: stageId } });
    if (!stage) throw ApiError.notFound('المرحلة التعليمية المحددة غير موجودة');

    const gradeLevel = await prisma.gradeLevel.findUnique({ where: { id: gradeLevelId } });
    if (!gradeLevel) throw ApiError.notFound('الصف الدراسي المحدد غير موجود');

    // Update Student Profile & Connect Subjects
    await prisma.$transaction(async (tx) => {
      // Clear previous subjects if any
      await tx.studentSubject.deleteMany({
        where: { studentId: studentProfile.id },
      });

      // Insert selected subjects
      const subjectMappings = finalSubjectIds.map((subjectId) => ({
        studentId: studentProfile.id,
        subjectId,
      }));


      await tx.studentSubject.createMany({
        data: subjectMappings,
      });

      // Update Profile
      await tx.studentProfile.update({
        where: { id: studentProfile.id },
        data: {
          stageId,
          gradeLevelId,
          parentPhone: parentPhone || studentProfile.parentPhone,
          isOnboardingCompleted: true,
        },
      });
    });

    return this.getStudentProfile(userId);
  }

  static async getStudentProfile(userId) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        appLanguage: true,
        darkMode: true,
        notifyExams: true,
        notifySubjects: true,
        notifyHomework: true,
        notifyAnnouncements: true,
        studentProfile: {
          include: {
            stage: true,
            gradeLevel: true,
            selectedSubjects: {
              include: {
                subject: true,
              },
            },
            enrollments: {
              include: {
                group: {
                  include: {
                    teacher: {
                      select: {
                        id: true,
                        fullName: true,
                        avatarUrl: true,
                      },
                    },
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    return profile;
  }

  static async updateProfile(userId, { fullName, phone, parentPhone, gradeLevelId, avatarUrl }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    await prisma.$transaction(async (tx) => {
      // Update User fields
      if (fullName || phone || avatarUrl) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(fullName && { fullName }),
            ...(phone && { phone }),
            ...(avatarUrl && { avatarUrl }),
          },
        });
      }

      // Update StudentProfile fields
      if (user.studentProfile && (parentPhone !== undefined || gradeLevelId)) {
        await tx.studentProfile.update({
          where: { id: user.studentProfile.id },
          data: {
            ...(parentPhone !== undefined && { parentPhone }),
            ...(gradeLevelId && { gradeLevelId }),
          },
        });
      }
    });

    return this.getStudentProfile(userId);
  }

  static async updateSelectedSubjects(userId, selectedSubjectIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentSubject.deleteMany({
        where: { studentId: user.studentProfile.id },
      });

      const subjectMappings = selectedSubjectIds.map((subjectId) => ({
        studentId: user.studentProfile.id,
        subjectId,
      }));

      await tx.studentSubject.createMany({
        data: subjectMappings,
      });
    });

    return this.getStudentProfile(userId);
  }

  static async updateSettings(userId, settings) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: settings,
      select: {
        id: true,
        appLanguage: true,
        darkMode: true,
        notifyExams: true,
        notifySubjects: true,
        notifyHomework: true,
        notifyAnnouncements: true,
      },
    });

    return updatedUser;
  }

  /**
   * Get complete student performance analytics, completion rates & subject strength breakdown
   */
  static async getStudentAnalytics(userId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              include: {
                subject: true,
                homeworks: true,
                exams: true,
              },
            },
          },
        },
        homeworkSubmissions: {
          include: {
            homework: {
              include: {
                group: { include: { subject: true } },
              },
            },
          },
        },
        examSubmissions: {
          include: {
            exam: {
              include: {
                group: { include: { subject: true } },
              },
            },
          },
        },
      },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    // 1. Homework Calculations
    let totalAssignedHomework = 0;
    studentProfile.enrollments.forEach((e) => {
      totalAssignedHomework += e.group.homeworks.length;
    });

    const completedHomework = studentProfile.homeworkSubmissions.length;
    const pendingHomework = Math.max(0, totalAssignedHomework - completedHomework);
    const homeworkCompletionRate = totalAssignedHomework > 0
      ? Math.round((completedHomework / totalAssignedHomework) * 100)
      : 100;

    let totalHomeworkScoreObtained = 0;
    let totalHomeworkMaxScore = 0;
    studentProfile.homeworkSubmissions.forEach((sub) => {
      totalHomeworkScoreObtained += sub.totalScoreObtained;
      totalHomeworkMaxScore += sub.homework.totalScore;
    });
    const averageHomeworkPercentage = totalHomeworkMaxScore > 0
      ? Math.round((totalHomeworkScoreObtained / totalHomeworkMaxScore) * 100)
      : 0;

    // 2. Exam Calculations
    let totalAssignedExams = 0;
    studentProfile.enrollments.forEach((e) => {
      totalAssignedExams += e.group.exams.length;
    });

    const completedExams = studentProfile.examSubmissions.length;
    const passedExams = studentProfile.examSubmissions.filter((sub) => sub.passed).length;
    
    let totalExamPercentageSum = 0;
    studentProfile.examSubmissions.forEach((sub) => {
      totalExamPercentageSum += sub.scorePercentage;
    });
    const overallExamAveragePercentage = completedExams > 0
      ? Math.round(totalExamPercentageSum / completedExams)
      : 0;

    // 3. Subject-by-Subject Strengths Breakdown
    const subjectStatsMap = new Map();
    studentProfile.enrollments.forEach((e) => {
      const subj = e.group.subject;
      if (!subjectStatsMap.has(subj.id)) {
        subjectStatsMap.set(subj.id, {
          subjectId: subj.id,
          subjectName: subj.nameAr,
          subjectIcon: subj.iconUrl,
          totalObtained: 0,
          totalMax: 0,
          submissionCount: 0,
        });
      }
    });

    studentProfile.homeworkSubmissions.forEach((sub) => {
      const subjId = sub.homework.group.subjectId;
      if (subjectStatsMap.has(subjId)) {
        const item = subjectStatsMap.get(subjId);
        item.totalObtained += sub.totalScoreObtained;
        item.totalMax += sub.homework.totalScore;
        item.submissionCount++;
      }
    });

    studentProfile.examSubmissions.forEach((sub) => {
      const subjId = sub.exam.group.subjectId;
      if (subjectStatsMap.has(subjId)) {
        const item = subjectStatsMap.get(subjId);
        item.totalObtained += sub.totalScoreObtained;
        item.totalMax += sub.exam.totalScore;
        item.submissionCount++;
      }
    });

    const subjectStrengths = Array.from(subjectStatsMap.values()).map((stat) => {
      const percentage = stat.totalMax > 0
        ? Math.round((stat.totalObtained / stat.totalMax) * 100)
        : 100;
      return {
        subjectId: stat.subjectId,
        subjectName: stat.subjectName,
        subjectIcon: stat.subjectIcon,
        performancePercentage: percentage,
        status: percentage >= 85 ? 'ممتاز' : percentage >= 70 ? 'جيد جداً' : percentage >= 50 ? 'جيد' : 'بحاجة لتحسين',
      };
    });

    return {
      homeworkAnalytics: {
        totalAssigned: totalAssignedHomework,
        completed: completedHomework,
        pending: pendingHomework,
        completionRatePercentage: homeworkCompletionRate,
        averageScorePercentage: averageHomeworkPercentage,
      },
      examAnalytics: {
        totalAssigned: totalAssignedExams,
        completed: completedExams,
        passed: passedExams,
        failed: completedExams - passedExams,
        overallAveragePercentage: overallExamAveragePercentage,
      },
      rankBadge: overallExamAveragePercentage >= 85
        ? 'أنت ضمن أعلى 15% من الطلاب'
        : overallExamAveragePercentage >= 70
        ? 'أنت ضمن أعلى 30% من الطلاب'
        : 'واصل المحاولة لتحسين ترتيبك',
      subjectStrengths,
    };
  }
}
