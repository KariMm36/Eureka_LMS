import prisma from '../../../config/prisma.js';

export class AdminFinanceService {
  /**
   * 1. Get Platform-Wide Financial Summary KPIs
   */
  static async getFinancialSummary() {
    const [paymentsAgg, paymentsByMethod] = await Promise.all([
      prisma.studentPayment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      prisma.studentPayment.groupBy({
        by: ['paymentMethod'],
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalRevenueCollected: Number(paymentsAgg._sum.amount || 0),
      recordedPaymentsCount: paymentsAgg._count,
      paymentMethodsBreakdown: paymentsByMethod.map((pm) => ({
        method: pm.paymentMethod,
        totalAmount: Number(pm._sum.amount || 0),
        count: pm._count,
      })),
    };
  }

  /**
   * 2. Get Paginated Payments Ledger Across All Groups
   */
  static async getPaymentsList({ groupId, paymentMethod, page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      ...(groupId && { groupId }),
      ...(paymentMethod && { paymentMethod }),
    };

    const [totalCount, payments] = await prisma.$transaction([
      prisma.studentPayment.count({ where }),
      prisma.studentPayment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { paidAt: 'desc' },
        include: {
          student: {
            include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
          },
          teacher: { select: { id: true, fullName: true } },
          group: { select: { id: true, name: true, groupCode: true } },
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
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        monthLabel: p.monthLabel,
        paymentMethod: p.paymentMethod,
        receiptUrl: p.receiptUrl,
        paidAt: p.paidAt,
        student: {
          id: p.student.user.id,
          fullName: p.student.user.fullName,
          phone: p.student.user.phone,
        },
        teacher: p.teacher,
        group: p.group,
      })),
    };
  }

  /**
   * 3. Get Enrolled Students with Unpaid / Overdue Status
   */
  static async getUnpaidStudents({ page = 1, limit = 50 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * pageSize;

    // Current month label (e.g. "2026-08")
    const now = new Date();
    const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [totalCount, enrollments] = await prisma.$transaction([
      prisma.groupEnrollment.count({
        where: {
          status: 'ACTIVE',
          group: { isActive: true },
        },
      }),
      prisma.groupEnrollment.findMany({
        where: {
          status: 'ACTIVE',
          group: { isActive: true },
        },
        skip,
        take: pageSize,
        include: {
          student: {
            include: {
              user: { select: { id: true, fullName: true, phone: true } },
            },
          },
          group: {
            include: {
              teacher: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
    ]);

    return {
      month: currentMonthLabel,
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNum * pageSize < totalCount,
      },
      unpaidRoster: enrollments.map((e) => ({
        enrollmentId: e.id,
        studentId: e.student.user.id,
        studentName: e.student.user.fullName,
        studentPhone: e.student.user.phone,
        parentPhone: e.student.parentPhone,
        groupName: e.group.name,
        teacherName: e.group.teacher?.fullName,
        monthlyFee: Number(e.customPrice || e.group.defaultPrice),
      })),
    };
  }

  /**
   * 4. Export Financial Records to CSV
   */
  static async exportFinancialCSV() {
    const payments = await prisma.studentPayment.findMany({
      orderBy: { paidAt: 'desc' },
      take: 5000,
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        teacher: { select: { fullName: true } },
        group: { select: { name: true } },
      },
    });

    const headers = ['Payment ID', 'Student Name', 'Teacher', 'Group', 'Amount', 'Month', 'Method', 'Paid At'];
    const escapeCsv = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;

    const rows = payments.map((p) => [
      escapeCsv(p.id),
      escapeCsv(p.student?.user?.fullName),
      escapeCsv(p.teacher?.fullName),
      escapeCsv(p.group?.name),
      escapeCsv(p.amount),
      escapeCsv(p.monthLabel),
      escapeCsv(p.paymentMethod),
      escapeCsv(p.paidAt.toISOString()),
    ]);

    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
