import bcrypt from 'bcryptjs';
import prisma from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';
import { AdminAuditService } from './admin-audit.service.js';
import { getIO } from '../../../config/socket.config.js';

export class AdminUsersService {
  /**
   * 1. Get Paginated Users List with Filters and Search
   */
  static async getUsersList({ role, status, search = '', page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      ...(role && { role }),
      ...(status === 'active' && { isActive: true }),
      ...(status === 'suspended' && { isActive: false }),
      ...(status === 'unverified' && { isVerified: false }),
      ...(status === 'verified' && { isVerified: true }),
      ...(search && {
        OR: [
          { fullName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
    };

    const orderBy = {
      [sortBy]: sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    const [totalCount, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          studentProfile: {
            select: {
              id: true,
              stage: { select: { id: true, nameAr: true } },
              gradeLevel: { select: { id: true, nameAr: true } },
            },
          },
          _count: {
            select: {
              teacherGroups: true,
              notifications: true,
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
      users,
    };
  }

  /**
   * 2. Get Comprehensive User Details by ID
   */
  static async getUserDetails(userId) {
    const user = await prisma.user.findUnique({
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
        isVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: {
          include: {
            stage: true,
            gradeLevel: true,
            selectedSubjects: { include: { subject: true } },
            enrollments: {
              include: {
                group: { include: { subject: true, teacher: { select: { id: true, fullName: true } } } },
              },
            },
          },
        },
        teacherGroups: {
          include: {
            subject: true,
            stage: true,
            gradeLevel: true,
            _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    return user;
  }

  /**
   * 3. Suspend or Activate User Account
   */
  static async updateUserStatus(adminId, userId, { isActive, reason = null }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, fullName: true },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    // Protection: Prevent suspending own admin account (self-lockout prevention)
    if (user.id === adminId && !isActive) {
      throw ApiError.badRequest('لا يمكنك تعطيل حساب المشرف الخاص بك');
    }

    // Protection: Prevent suspending the last active Admin
    if (!isActive && user.role === 'ADMIN') {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw ApiError.badRequest('لا يمكن تعطيل المشرف الأخير المتبقي في النظام');
      }
    }

    // If suspending: force clear session token
    const updateData = { isActive: Boolean(isActive) };
    if (!isActive) {
      updateData.refreshTokenHash = null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Disconnect active Socket.IO connection if suspended
    if (!isActive) {
      try {
        const io = getIO();
        io.in(`user:${userId}`).disconnectSockets(true);
      } catch (_) {}
    }

    // Record Audit Log
    await AdminAuditService.logAction({
      adminId,
      action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
      resource: 'USER',
      resourceId: userId,
      reason,
      metadata: { previousStatus: user.isActive, newStatus: isActive, targetUserName: user.fullName },
    });

    return updated;
  }

  /**
   * 4. Change User Role (Safeguards against self-lockout and last-admin removal)
   */
  static async changeUserRole(adminId, userId, { role, reason = null }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, fullName: true },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    if (user.id === adminId && role !== 'ADMIN') {
      throw ApiError.badRequest('لا يمكنك إزالة دور المشرف (ADMIN) عن حسابك الخاص');
    }

    if (user.role === 'ADMIN' && role !== 'ADMIN') {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw ApiError.badRequest('لا يمكن تغيير دور المشرف الأخير المتبقي في النظام');
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role, refreshTokenHash: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    try {
      const io = getIO();
      io.in(`user:${userId}`).disconnectSockets(true);
    } catch (_) {}

    await AdminAuditService.logAction({
      adminId,
      action: 'USER_ROLE_CHANGED',
      resource: 'USER',
      resourceId: userId,
      reason,
      metadata: { previousRole: user.role, newRole: role, targetUserName: user.fullName },
    });

    return updated;
  }

  /**
   * 5. Force Logout User (Revoke refresh token & disconnect Socket.IO)
   */
  static async forceLogoutUser(adminId, userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    try {
      const io = getIO();
      io.in(`user:${userId}`).disconnectSockets(true);
    } catch (_) {}

    await AdminAuditService.logAction({
      adminId,
      action: 'USER_FORCE_LOGGED_OUT',
      resource: 'USER',
      resourceId: userId,
      metadata: { targetUserName: user.fullName },
    });

    return { message: 'تم إنهاء جميع جلسات المستخدم بنجاح' };
  }

  /**
   * 6. Admin Password Reset
   */
  static async adminResetPassword(adminId, userId, { newPassword, reason = null }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    });

    if (!user) {
      throw ApiError.notFound('المستخدم غير موجود');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        refreshTokenHash: null, // Require fresh login with new password
      },
    });

    try {
      const io = getIO();
      io.in(`user:${userId}`).disconnectSockets(true);
    } catch (_) {}

    await AdminAuditService.logAction({
      adminId,
      action: 'USER_PASSWORD_RESET',
      resource: 'USER',
      resourceId: userId,
      reason,
      metadata: { targetUserName: user.fullName, targetUserEmail: user.email },
    });

    return { message: 'تم تعيين كلمة المرور الجديدة للمستخدم بنجاح' };
  }

  /**
   * 7. Export Users Roster to CSV
   */
  static async exportUsersCSV() {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    const headers = ['ID', 'Full Name', 'Email', 'Phone', 'Role', 'Verified', 'Active', 'Created At'];
    const escapeCsv = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;

    const rows = users.map((u) => [
      escapeCsv(u.id),
      escapeCsv(u.fullName),
      escapeCsv(u.email),
      escapeCsv(u.phone),
      escapeCsv(u.role),
      escapeCsv(u.isVerified ? 'YES' : 'NO'),
      escapeCsv(u.isActive ? 'ACTIVE' : 'SUSPENDED'),
      escapeCsv(u.createdAt.toISOString()),
    ]);

    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
