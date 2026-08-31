import prisma from '../../../config/prisma.js';

export class AdminAuditService {
  /**
   * Append-only administrative action logger
   */
  static async logAction({ adminId, action, resource, resourceId = null, reason = null, metadata = null }) {
    try {
      return await prisma.auditLog.create({
        data: {
          adminId,
          action,
          resource,
          resourceId,
          reason,
          metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        },
      });
    } catch (err) {
      console.error('[Admin Audit Error]: Failed to create audit log entry:', err.message);
      return null;
    }
  }

  /**
   * Retrieve paginated audit logs
   */
  static async getAuditLogs({ action, resource, adminId, page = 1, limit = 30 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      ...(action && { action }),
      ...(resource && { resource }),
      ...(adminId && { adminId }),
    };

    const [totalCount, logs] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, fullName: true, email: true, role: true },
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
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        reason: log.reason,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        createdAt: log.createdAt,
        admin: log.admin,
      })),
    };
  }
}
