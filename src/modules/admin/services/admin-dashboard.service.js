import prisma from '../../../config/prisma.js';

export class AdminDashboardService {
  /**
   * Get Consolidated Executive Platform KPIs
   */
  static async getDashboardKPIs() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalStudents,
      totalTeachers,
      pendingTeachers,
      totalGroups,
      activeEnrollments,
      upcomingExams,
      pendingHomeworkGrading,
      todayAttendance,
      revenueSummary,
      recentAuditLogs,
      systemSettings,
    ] = await prisma.$transaction([
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.user.count({ where: { role: 'TEACHER', isVerified: true, isActive: true } }),
      prisma.user.count({ where: { role: 'TEACHER', isVerified: false, isActive: true } }),
      prisma.group.count({ where: { isActive: true } }),
      prisma.groupEnrollment.count({ where: { status: 'ACTIVE' } }),
      prisma.exam.count({ where: { startTime: { gte: now } } }),
      prisma.homeworkSubmission.count({ where: { status: 'SUBMITTED' } }),
      prisma.attendance.count({ where: { recordedAt: { gte: startOfToday }, status: 'PRESENT' } }),
      prisma.studentPayment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { fullName: true, email: true } } },
      }),
      prisma.systemSetting.findUnique({ where: { id: 'default' } }),
    ]);

    return {
      platformStats: {
        totalActiveStudents: totalStudents,
        totalVerifiedTeachers: totalTeachers,
        pendingTeacherApprovals: pendingTeachers,
        totalActiveGroups: totalGroups,
        totalActiveEnrollments: activeEnrollments,
      },
      academicActivity: {
        upcomingExamsCount: upcomingExams,
        pendingHomeworkGradingCount: pendingHomeworkGrading,
        todayPresentAttendanceCount: todayAttendance,
      },
      financialSummary: {
        totalRevenueCollected: Number(revenueSummary._sum.amount || 0),
        approvedPaymentsCount: revenueSummary._count,
      },
      systemStatus: {
        maintenanceMode: Boolean(systemSettings?.maintenanceMode),
        registrationOpen: Boolean(systemSettings?.registrationOpen),
      },
      recentActivity: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        reason: log.reason,
        adminName: log.admin?.fullName,
        createdAt: log.createdAt,
      })),
    };
  }
}
