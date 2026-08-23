import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export class GroupService {
  /**
   * 1. Search & Browse groups with Pagination & Compound Filtering
   * Matches Screen 2 (Browse Groups)
   */
  static async searchGroups({ query, subjectId, stageId, gradeLevelId, page = 1, limit = 20 }) {
    const pageNumber = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNumber - 1) * pageSize;

    const where = {
      isActive: true,
      ...(subjectId && { subjectId }),
      ...(stageId && { stageId }),
      ...(gradeLevelId && { gradeLevelId }),
      ...(query && {
        OR: [
          { name: { contains: query } },
          { groupCode: { contains: query } },
          { teacher: { fullName: { contains: query } } },
          { subject: { nameAr: { contains: query } } },
        ],
      }),
    };

    const [totalCount, groups] = await prisma.$transaction([
      prisma.group.count({ where }),
      prisma.group.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          teacher: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              phone: true,
            },
          },
          subject: true,
          stage: true,
          gradeLevel: true,
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedGroups = groups.map((g) => ({
      id: g.id,
      name: g.name,
      groupCode: g.groupCode,
      scheduleDays: g.scheduleDays.split(','),
      scheduleTime: g.scheduleTime,
      maxCapacity: g.maxCapacity,
      studentCount: g._count.enrollments,
      isFull: g._count.enrollments >= g.maxCapacity,
      teacher: g.teacher,
      subject: g.subject,
      stage: g.stage,
      gradeLevel: g.gradeLevel,
    }));

    return {
      pagination: {
        totalCount,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNumber * pageSize < totalCount,
      },
      groups: formattedGroups,
    };
  }

  /**
   * 2. Preview group details by code before joining
   */
  static async previewGroupByCode(groupCode) {
    const cleanCode = groupCode.trim().toUpperCase();

    const group = await prisma.group.findUnique({
      where: { groupCode: cleanCode },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        subject: true,
        stage: true,
        gradeLevel: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!group || !group.isActive) {
      throw ApiError.notFound('كود المجموعة غير صحيح أو المجموعة غير مفعلة');
    }

    return {
      id: group.id,
      name: group.name,
      groupCode: group.groupCode,
      scheduleDays: group.scheduleDays.split(','),
      scheduleTime: group.scheduleTime,
      studentCount: group._count.enrollments,
      maxCapacity: group.maxCapacity,
      isFull: group._count.enrollments >= group.maxCapacity,
      teacher: group.teacher,
      subject: group.subject,
      stage: group.stage,
      gradeLevel: group.gradeLevel,
    };
  }

  /**
   * 3. Join group by code with Atomic Race-Condition Protection
   */
  static async joinGroupByCode(userId, groupCode) {
    const cleanCode = groupCode.trim().toUpperCase();

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    // Atomic transaction to ensure maxCapacity is never violated concurrently
    return prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { groupCode: cleanCode },
        include: {
          _count: { select: { enrollments: true } },
        },
      });

      if (!group || !group.isActive) {
        throw ApiError.notFound('كود المجموعة غير صحيح أو المجموعة غير مفعلة');
      }

      if (group._count.enrollments >= group.maxCapacity) {
        throw ApiError.badRequest('عذراً، المجموعة ممتلئة بالكامل');
      }

      const existingEnrollment = await tx.groupEnrollment.findUnique({
        where: {
          groupId_studentId: {
            groupId: group.id,
            studentId: studentProfile.id,
          },
        },
      });

      if (existingEnrollment) {
        throw ApiError.conflict('أنت منضم بالفعل إلى هذه المجموعة');
      }

      const enrollment = await tx.groupEnrollment.create({
        data: {
          groupId: group.id,
          studentId: studentProfile.id,
          status: 'ACTIVE',
        },
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
      });

      return {
        message: `تم الانضمام بنجاح إلى ${group.name}`,
        enrollment,
      };
    });
  }

  /**
   * 4. Join open group directly by Group ID with Atomic Protection
   */
  static async joinGroupById(userId, groupId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    return prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          _count: { select: { enrollments: true } },
        },
      });

      if (!group || !group.isActive) {
        throw ApiError.notFound('المجموعة غير موجودة أو غير مفعلة');
      }

      if (group._count.enrollments >= group.maxCapacity) {
        throw ApiError.badRequest('عذراً، المجموعة ممتلئة بالكامل');
      }

      const existingEnrollment = await tx.groupEnrollment.findUnique({
        where: {
          groupId_studentId: {
            groupId: group.id,
            studentId: studentProfile.id,
          },
        },
      });

      if (existingEnrollment) {
        throw ApiError.conflict('أنت منضم بالفعل إلى هذه المجموعة');
      }

      const enrollment = await tx.groupEnrollment.create({
        data: {
          groupId: group.id,
          studentId: studentProfile.id,
          status: 'ACTIVE',
        },
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
      });

      return {
        message: `تم الانضمام بنجاح إلى ${group.name}`,
        enrollment,
      };
    });
  }

  /**
   * 5. Get list of groups the student is currently enrolled in
   */
  static async getMyGroups(userId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const enrollments = await prisma.groupEnrollment.findMany({
      where: {
        studentId: studentProfile.id,
        status: 'ACTIVE',
      },
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
            stage: true,
            gradeLevel: true,
            _count: {
              select: { enrollments: true, homeworks: true, exams: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return enrollments.map((e) => ({
      enrollmentId: e.id,
      joinedAt: e.joinedAt,
      group: {
        id: e.group.id,
        name: e.group.name,
        groupCode: e.group.groupCode,
        scheduleDays: e.group.scheduleDays.split(','),
        scheduleTime: e.group.scheduleTime,
        studentCount: e.group._count.enrollments,
        homeworkCount: e.group._count.homeworks,
        examsCount: e.group._count.exams,
        teacher: e.group.teacher,
        subject: e.group.subject,
        stage: e.group.stage,
        gradeLevel: e.group.gradeLevel,
      },
    }));
  }

  /**
   * 6. Get single group details
   */
  static async getGroupDetails(userId, groupId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            phone: true,
          },
        },
        subject: true,
        stage: true,
        gradeLevel: true,
        homeworks: {
          where: { dueDate: { gte: new Date() } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        },
        exams: {
          where: { endTime: { gte: new Date() } },
          orderBy: { startTime: 'asc' },
          take: 5,
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!group) {
      throw ApiError.notFound('المجموعة غير موجودة');
    }

    return {
      ...group,
      scheduleDays: group.scheduleDays.split(','),
      studentCount: group._count.enrollments,
    };
  }
}
