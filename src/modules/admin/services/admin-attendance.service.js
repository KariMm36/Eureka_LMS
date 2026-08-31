import prisma from '../../../config/prisma.js';

export class AdminAttendanceService {
  /**
   * 1. Get System-Wide Attendance Overview KPIs
   */
  static async getAttendanceOverview() {
    const [totalSessions, totalRecords, presentRecords, absentRecords] = await Promise.all([
      prisma.classSession.count(),
      prisma.attendance.count(),
      prisma.attendance.count({ where: { status: 'PRESENT' } }),
      prisma.attendance.count({ where: { status: 'ABSENT' } }),
    ]);

    const systemAttendancePercentage = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 100;

    return {
      totalSessions,
      totalRecords,
      presentRecords,
      absentRecords,
      systemAttendancePercentage,
    };
  }

  /**
   * 2. Get At-Risk Students with Attendance Rate Below Configurable Threshold (Default 75%)
   */
  static async getAtRiskStudents({ threshold = 75, page = 1, limit = 50 } = {}) {
    const numThreshold = Math.max(1, Math.min(100, parseInt(threshold, 10) || 75));
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    // Fetch all active students with attendances
    const students = await prisma.studentProfile.findMany({
      where: {
        user: { isActive: true },
        attendances: { some: {} }, // only students with at least 1 session
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        stage: { select: { nameAr: true } },
        gradeLevel: { select: { nameAr: true } },
        attendances: { select: { status: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { group: { select: { id: true, name: true } } },
        },
      },
    });

    const atRiskStudents = [];

    for (const s of students) {
      const total = s.attendances.length;
      if (total === 0) continue;
      const present = s.attendances.filter((a) => a.status === 'PRESENT').length;
      const rate = Math.round((present / total) * 100);

      if (rate < numThreshold) {
        atRiskStudents.push({
          studentProfileId: s.id,
          userId: s.user.id,
          fullName: s.user.fullName,
          email: s.user.email,
          phone: s.user.phone,
          parentPhone: s.parentPhone,
          stage: s.stage?.nameAr,
          gradeLevel: s.gradeLevel?.nameAr,
          totalSessions: total,
          attendedSessions: present,
          absentSessions: total - present,
          attendanceRate: rate,
          activeGroups: s.enrollments.map((e) => e.group.name),
        });
      }
    }

    // Sort by lowest attendance rate first
    atRiskStudents.sort((a, b) => a.attendanceRate - b.attendanceRate);

    const totalCount = atRiskStudents.length;
    const paginated = atRiskStudents.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    return {
      threshold: numThreshold,
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNum * pageSize < totalCount,
      },
      students: paginated,
    };
  }

  /**
   * 3. Export Attendance Roster to CSV
   */
  static async exportAttendanceCSV() {
    const attendances = await prisma.attendance.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 5000,
      include: {
        student: {
          include: { user: { select: { fullName: true, phone: true } } },
        },
        session: {
          include: { group: { select: { name: true } } },
        },
      },
    });

    const headers = ['Record ID', 'Student Name', 'Phone', 'Group', 'Session Date', 'Status', 'Recorded At'];
    const escapeCsv = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;

    const rows = attendances.map((a) => [
      escapeCsv(a.id),
      escapeCsv(a.student?.user?.fullName),
      escapeCsv(a.student?.user?.phone),
      escapeCsv(a.session?.group?.name),
      escapeCsv(a.session?.sessionDate?.toISOString() || ''),
      escapeCsv(a.status),
      escapeCsv(a.recordedAt.toISOString()),
    ]);

    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
