import prisma from '../config/prisma.js';
import { ApiError } from './apiError.js';

/**
 * Reusable ownership verification utilities for Teacher Portal (IDOR prevention)
 */
export class OwnershipUtil {
  /**
   * Verify that the teacher owns the specified group
   */
  static async verifyGroupOwnership(teacherId, groupId) {
    if (!groupId) {
      throw ApiError.badRequest('معرف المجموعة مطلوب');
    }

    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        teacherId,
      },
    });

    if (!group) {
      throw ApiError.notFound('المجموعة غير موجودة أو ليس لديك الصلاحية للوصول إليها');
    }

    return group;
  }

  /**
   * Verify that a student is actively enrolled in at least one group taught by this teacher
   */
  static async verifyStudentInTeacherGroup(teacherId, studentProfileId) {
    if (!studentProfileId) {
      throw ApiError.badRequest('معرف الطالب مطلوب');
    }

    const enrollment = await prisma.groupEnrollment.findFirst({
      where: {
        studentId: studentProfileId,
        group: {
          teacherId,
        },
      },
      include: {
        group: true,
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw ApiError.forbidden('هذا الطالب غير مسجل في أي من مجموعاتك');
    }

    return enrollment;
  }

  /**
   * Verify that the teacher owns the specified homework
   */
  static async verifyHomeworkOwnership(teacherId, homeworkId) {
    if (!homeworkId) {
      throw ApiError.badRequest('معرف الواجب مطلوب');
    }

    const homework = await prisma.homework.findFirst({
      where: {
        id: homeworkId,
        group: {
          teacherId,
        },
      },
      include: {
        group: true,
      },
    });

    if (!homework) {
      throw ApiError.notFound('الواجب غير موجود أو ليس لديك الصلاحية للوصول إليه');
    }

    return homework;
  }

  /**
   * Verify that the teacher owns the specified exam
   */
  static async verifyExamOwnership(teacherId, examId) {
    if (!examId) {
      throw ApiError.badRequest('معرف الامتحان مطلوب');
    }

    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        group: {
          teacherId,
        },
      },
      include: {
        group: true,
      },
    });

    if (!exam) {
      throw ApiError.notFound('الامتحان غير موجود أو ليس لديك الصلاحية للوصول إليه');
    }

    return exam;
  }

  /**
   * Verify that the teacher owns the specified class session
   */
  static async verifySessionOwnership(teacherId, sessionId) {
    if (!sessionId) {
      throw ApiError.badRequest('معرف الجلسة مطلوب');
    }

    const session = await prisma.classSession.findFirst({
      where: {
        id: sessionId,
        group: {
          teacherId,
        },
      },
      include: {
        group: true,
      },
    });

    if (!session) {
      throw ApiError.notFound('جلسة الحضور غير موجودة أو ليس لديك الصلاحية للوصول إليها');
    }

    return session;
  }

  /**
   * Verify that the teacher owns the specified unit
   */
  static async verifyUnitOwnership(teacherId, unitId) {
    if (!unitId) {
      throw ApiError.badRequest('معرف الوحدة مطلوب');
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        createdById: teacherId,
      },
    });

    if (!unit) {
      throw ApiError.notFound('الوحدة الدراسية غير موجودة أو ليس لديك الصلاحية لتعديلها');
    }

    return unit;
  }

  /**
   * Verify that the teacher owns the specified lesson
   */
  static async verifyLessonOwnership(teacherId, lessonId) {
    if (!lessonId) {
      throw ApiError.badRequest('معرف الدرس مطلوب');
    }

    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        createdById: teacherId,
      },
      include: {
        unit: true,
      },
    });

    if (!lesson) {
      throw ApiError.notFound('الدرس غير موجود أو ليس لديك الصلاحية لتعديله');
    }

    return lesson;
  }
}

