import prisma from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';
import { AdminAuditService } from './admin-audit.service.js';

export class AdminGroupsService {
  /**
   * 1. Get Platform-Wide Groups Directory
   */
  static async getGroupsList({ search = '', stageId, gradeLevelId, teacherId, isActive, page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      ...(stageId && { stageId }),
      ...(gradeLevelId && { gradeLevelId }),
      ...(teacherId && { teacherId }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { groupCode: { contains: search } },
          { teacher: { fullName: { contains: search } } },
        ],
      }),
    };

    const [totalCount, groups] = await prisma.$transaction([
      prisma.group.count({ where }),
      prisma.group.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          teacher: { select: { id: true, fullName: true, email: true, phone: true } },
          subject: { select: { id: true, nameAr: true, nameEn: true } },
          stage: { select: { id: true, nameAr: true } },
          gradeLevel: { select: { id: true, nameAr: true } },
          _count: {
            select: {
              enrollments: { where: { status: 'ACTIVE' } },
              sessions: true,
              homeworks: true,
              exams: true,
            },
          },
        },
      }),
    ]);

    return {
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNum * pageSize < totalCount,
      },
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        groupCode: g.groupCode,
        teacher: g.teacher,
        subject: g.subject,
        stage: g.stage,
        gradeLevel: g.gradeLevel,
        scheduleDays: g.scheduleDays,
        scheduleTime: g.scheduleTime,
        maxCapacity: g.maxCapacity,
        activeStudentsCount: g._count.enrollments,
        totalSessions: g._count.sessions,
        totalHomeworks: g._count.homeworks,
        totalExams: g._count.exams,
        defaultPrice: Number(g.defaultPrice),
        isActive: g.isActive,
        createdAt: g.createdAt,
      })),
    };
  }

  /**
   * 2. Get Group Details with Enrolled Student Roster
   */
  static async getGroupDetails(groupId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teacher: { select: { id: true, fullName: true, email: true, phone: true } },
        subject: true,
        stage: true,
        gradeLevel: true,
        enrollments: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } },
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        },
        _count: {
          select: {
            homeworks: true,
            exams: true,
            sessions: true,
          },
        },
      },
    });

    if (!group) {
      throw ApiError.notFound('المجموعة غير موجودة');
    }

    return {
      id: group.id,
      name: group.name,
      groupCode: group.groupCode,
      teacher: group.teacher,
      subject: group.subject,
      stage: group.stage,
      gradeLevel: group.gradeLevel,
      scheduleDays: group.scheduleDays,
      scheduleTime: group.scheduleTime,
      maxCapacity: group.maxCapacity,
      defaultPrice: Number(group.defaultPrice),
      coverImageUrl: group.coverImageUrl,
      description: group.description,
      isActive: group.isActive,
      stats: {
        totalHomeworks: group._count.homeworks,
        totalExams: group._count.exams,
        totalSessions: group._count.sessions,
        totalEnrolledStudents: group.enrollments.filter((e) => e.status === 'ACTIVE').length,
      },
      studentsRoster: group.enrollments.map((e) => ({
        enrollmentId: e.id,
        studentProfileId: e.studentId,
        userId: e.student.user.id,
        fullName: e.student.user.fullName,
        phone: e.student.user.phone,
        parentPhone: e.student.parentPhone,
        status: e.status,
        enrollmentPrice: e.enrollmentPrice ? Number(e.enrollmentPrice) : null,
        joinedAt: e.joinedAt,
      })),
    };
  }

  /**
   * 3. Toggle Group Active Status
   */
  static async toggleGroupStatus(adminId, groupId, { isActive, reason = null }) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, isActive: true },
    });

    if (!group) {
      throw ApiError.notFound('المجموعة غير موجودة');
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: { isActive: Boolean(isActive) },
      select: { id: true, name: true, isActive: true },
    });

    await AdminAuditService.logAction({
      adminId,
      action: isActive ? 'GROUP_ACTIVATED' : 'GROUP_DEACTIVATED',
      resource: 'GROUP',
      resourceId: groupId,
      reason,
      metadata: { groupName: group.name, previousState: group.isActive, newState: isActive },
    });

    return updated;
  }

  /**
   * 4. Reassign Group to Another Teacher
   */
  static async assignGroupTeacher(adminId, groupId, { teacherId, reason = null }) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, teacherId: true },
    });

    if (!group) {
      throw ApiError.notFound('المجموعة غير موجودة');
    }

    const newTeacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, fullName: true, role: true },
    });

    if (!newTeacher || newTeacher.role !== 'TEACHER') {
      throw ApiError.notFound('المعلم الجديد غير موجود أو ليس لديه حساب معلم');
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: { teacherId },
      select: { id: true, name: true, teacherId: true },
    });

    await AdminAuditService.logAction({
      adminId,
      action: 'GROUP_TEACHER_REASSIGNED',
      resource: 'GROUP',
      resourceId: groupId,
      reason,
      metadata: { groupName: group.name, oldTeacherId: group.teacherId, newTeacherId: teacherId },
    });

    return updated;
  }
}
