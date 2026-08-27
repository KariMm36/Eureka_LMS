import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export class AcademicService {
  /**
   * 1. Get all stages and grades
   */
  static async getAllStages() {
    return prisma.stage.findMany({
      orderBy: { order: 'asc' },
      include: {
        grades: {
          orderBy: { gradeNumber: 'asc' },
        },
      },
    });
  }

  /**
   * 2. Get all subjects
   */
  static async getSubjects(gradeLevelId = null, teacherId = null) {
    if (!gradeLevelId && !teacherId) {
      return prisma.subject.findMany({
        where: { isGlobal: true },
        orderBy: { nameAr: 'asc' },
      });
    }

    const where = {
      OR: [
        { isGlobal: true },
        ...(teacherId ? [{ createdById: teacherId }] : []),
      ],
    };

    if (!gradeLevelId) {
      return prisma.subject.findMany({
        where,
        orderBy: { nameAr: 'asc' },
      });
    }

    return prisma.subject.findMany({
      where,
      orderBy: { nameAr: 'asc' },
      include: {
        units: {
          where: { gradeLevelId },
          include: {
            lessons: {
              include: {
                videos: true,
                materials: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 3. Get units and lessons for a specific subject
   */
  static async getSubjectUnits(subjectId, gradeLevelId) {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw ApiError.notFound('المادة الدراسية غير موجودة');
    }

    const whereClause = { subjectId };
    if (gradeLevelId) {
      whereClause.gradeLevelId = gradeLevelId;
    }

    const units = await prisma.unit.findMany({
      where: whereClause,
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            videos: true,
            materials: true,
            homework: {
              select: { id: true, title: true, dueDate: true, totalScore: true },
            },
            exams: {
              select: { id: true, title: true, durationMinutes: true, totalScore: true },
            },
          },
        },
      },
    });

    return {
      subject,
      units,
    };
  }

  /**
   * 4. Get lesson details
   */
  static async getLessonDetails(lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        videos: true,
        materials: true,
        homework: {
          select: { id: true, title: true, dueDate: true, durationMinutes: true, totalScore: true },
        },
        exams: {
          select: { id: true, title: true, durationMinutes: true, totalScore: true },
        },
        unit: {
          include: {
            subject: true,
            gradeLevel: true,
          },
        },
      },
    });

    if (!lesson) {
      throw ApiError.notFound('الدرس غير موجود');
    }

    return lesson;
  }
}
