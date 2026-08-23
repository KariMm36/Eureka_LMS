import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export class StudentService {
  static async completeOnboarding(userId, { stageId, gradeLevelId, selectedSubjectIds, parentPhone }) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

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
      const subjectMappings = selectedSubjectIds.map((subjectId) => ({
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
}
