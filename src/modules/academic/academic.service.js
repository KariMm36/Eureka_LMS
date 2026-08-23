import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { CacheUtil } from '../../utils/cache.util.js';

const CACHE_KEYS = {
  STAGES: 'academic:stages',
  SUBJECTS_ALL: 'academic:subjects:all',
};

export class AcademicService {
  /**
   * 1. Get all stages and grades with In-Memory Caching (1ms latency)
   */
  static async getAllStages() {
    const cached = CacheUtil.get(CACHE_KEYS.STAGES);
    if (cached) return cached;

    const stages = await prisma.stage.findMany({
      orderBy: { order: 'asc' },
      include: {
        grades: {
          orderBy: { gradeNumber: 'asc' },
        },
      },
    });

    CacheUtil.set(CACHE_KEYS.STAGES, stages, 7200); // Cache for 2 hours
    return stages;
  }

  /**
   * 2. Get all subjects with In-Memory Caching
   */
  static async getSubjects(gradeLevelId = null) {
    if (!gradeLevelId) {
      const cached = CacheUtil.get(CACHE_KEYS.SUBJECTS_ALL);
      if (cached) return cached;

      const subjects = await prisma.subject.findMany({
        orderBy: { nameAr: 'asc' },
      });

      CacheUtil.set(CACHE_KEYS.SUBJECTS_ALL, subjects, 7200);
      return subjects;
    }

    return prisma.subject.findMany({
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
