import prisma from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';
import { AdminAuditService } from './admin-audit.service.js';
import { getIO } from '../../../config/socket.config.js';

export class AdminTeachersService {
  /**
   * 1. Get Pending Teacher Approval Queue
   */
  static async getPendingTeachers({ page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      role: 'TEACHER',
      isVerified: false,
      isActive: true,
    };

    const [totalCount, teachers] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'asc' }, // Oldest applications first
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
          _count: {
            select: { teacherGroups: true },
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
      teachers,
    };
  }

  /**
   * 2. Approve Teacher Account (Grants Verified Badge + In-App/Socket Notification)
   */
  static async approveTeacher(adminId, teacherId) {
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, role: true, isVerified: true, fullName: true },
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      throw ApiError.notFound('المعلم غير موجود');
    }

    const updated = await prisma.user.update({
      where: { id: teacherId },
      data: { isVerified: true, isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        isVerified: true,
        isActive: true,
      },
    });

    // In-App Notification
    const notifTitle = '🎉 تم توثيق واعتماد حسابك';
    const notifBody = 'تهانينا! قامت إدارة المنصة بتوثيق واعتماد حسابك كمعلم في منصة يوريكا التعليمية.';

    await prisma.notification.create({
      data: {
        userId: teacherId,
        title: notifTitle,
        body: notifBody,
        type: 'ANNOUNCEMENT',
      },
    });

    // Real-Time Socket.IO Alert
    try {
      const io = getIO();
      io.to(`user:${teacherId}`).emit('notification:new', {
        title: notifTitle,
        body: notifBody,
        type: 'ANNOUNCEMENT',
        createdAt: new Date(),
      });
    } catch (_) {}

    await AdminAuditService.logAction({
      adminId,
      action: 'TEACHER_APPROVED',
      resource: 'TEACHER',
      resourceId: teacherId,
      metadata: { teacherName: teacher.fullName },
    });

    return updated;
  }

  /**
   * 3. Reject / Deactivate Teacher Application
   */
  static async rejectTeacher(adminId, teacherId, { reason = null } = {}) {
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, role: true, fullName: true },
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      throw ApiError.notFound('المعلم غير موجود');
    }

    const updated = await prisma.user.update({
      where: { id: teacherId },
      data: { isVerified: false, isActive: false, refreshTokenHash: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        isVerified: true,
        isActive: true,
      },
    });

    try {
      const io = getIO();
      io.in(`user:${teacherId}`).disconnectSockets(true);
    } catch (_) {}

    await AdminAuditService.logAction({
      adminId,
      action: 'TEACHER_REJECTED',
      resource: 'TEACHER',
      resourceId: teacherId,
      reason,
      metadata: { teacherName: teacher.fullName },
    });

    return updated;
  }

  /**
   * 4. Get 360° Teacher Performance & Workload Statistics
   */
  static async getTeacherStats(teacherId) {
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!teacher) {
      throw ApiError.notFound('المعلم غير موجود');
    }

    const [
      groups,
      totalActiveStudents,
      totalHomeworks,
      totalExams,
      totalSessions,
      financialAgg,
    ] = await Promise.all([
      prisma.group.findMany({
        where: { teacherId },
        include: {
          subject: true,
          stage: true,
          gradeLevel: true,
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
      }),
      prisma.groupEnrollment.count({
        where: { group: { teacherId }, status: 'ACTIVE' },
      }),
      prisma.homework.count({ where: { createdById: teacherId } }),
      prisma.exam.count({ where: { createdById: teacherId } }),
      prisma.classSession.count({ where: { createdById: teacherId } }),
      prisma.studentPayment.aggregate({
        where: { teacherId },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      teacher,
      workload: {
        totalGroups: groups.length,
        totalActiveStudents,
        totalHomeworks,
        totalExams,
        totalSessions,
        totalRevenueCollected: Number(financialAgg._sum.amount || 0),
        totalApprovedPaymentsCount: financialAgg._count,
      },
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        groupCode: g.groupCode,
        subjectName: g.subject?.nameAr,
        stageName: g.stage?.nameAr,
        gradeLevelName: g.gradeLevel?.nameAr,
        studentCount: g._count.enrollments,
        scheduleDays: g.scheduleDays,
        scheduleTime: g.scheduleTime,
        isActive: g.isActive,
      })),
    };
  }
}
