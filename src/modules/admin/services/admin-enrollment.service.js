import prisma from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';
import { getIO } from '../../../config/socket.config.js';

export class AdminEnrollmentService {
  /**
   * 1. Direct Administrative Manual Student Enrollment (Atomic Transaction)
   */
  static async manualEnrollStudent(adminId, { studentProfileId, groupId, enrollmentPrice, reason = null }) {
    return prisma.$transaction(async (tx) => {
      const [studentProfile, group] = await Promise.all([
        tx.studentProfile.findUnique({
          where: { id: studentProfileId },
          include: { user: { select: { id: true, fullName: true } } },
        }),
        tx.group.findUnique({
          where: { id: groupId },
          include: {
            _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
          },
        }),
      ]);

      if (!studentProfile) {
        throw ApiError.notFound('بروفايل الطالب غير موجود');
      }
      if (!group || !group.isActive) {
        throw ApiError.notFound('المجموعة غير موجودة أو غير مفعلة');
      }

      const existingEnrollment = await tx.groupEnrollment.findFirst({
        where: { studentId: studentProfileId, groupId },
      });

      if (existingEnrollment && existingEnrollment.status === 'ACTIVE') {
        throw ApiError.conflict('الطالب مسجل بالفعل في هذه المجموعة وحسابه نشط');
      }

      // Check group capacity
      if (group._count.enrollments >= group.maxCapacity) {
        throw ApiError.badRequest('عذراً، المجموعة ممتلئة بالكامل');
      }

      let enrollment;
      if (existingEnrollment) {
        enrollment = await tx.groupEnrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: 'ACTIVE',
            ...(enrollmentPrice !== undefined && { enrollmentPrice: parseFloat(enrollmentPrice) }),
            joinedAt: new Date(),
            addedBy: adminId,
          },
        });
      } else {
        enrollment = await tx.groupEnrollment.create({
          data: {
            studentId: studentProfileId,
            groupId,
            status: 'ACTIVE',
            enrollmentPrice: enrollmentPrice !== undefined ? parseFloat(enrollmentPrice) : group.defaultPrice,
            addedBy: adminId,
          },
        });
      }

      // Record Audit Log atomically
      await tx.auditLog.create({
        data: {
          adminId,
          action: 'STUDENT_MANUALLY_ENROLLED',
          resource: 'ENROLLMENT',
          resourceId: enrollment.id,
          reason,
          metadata: JSON.stringify({
            studentName: studentProfile.user.fullName,
            groupName: group.name,
            groupId,
            studentProfileId,
          }),
        },
      });

      return {
        enrollment,
        group: { id: group.id, name: group.name },
        student: { id: studentProfile.user.id, fullName: studentProfile.user.fullName },
      };
    });
  }

  /**
   * 2. Transactional Student Group Transfer (Preserving Academic History)
   */
  static async transferStudentGroup(adminId, { studentProfileId, fromGroupId, toGroupId, reason = null }) {
    if (fromGroupId === toGroupId) {
      throw ApiError.badRequest('لا يمكن نقل الطالب إلى نفس المجموعة الحالية');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Verify Student
      const studentProfile = await tx.studentProfile.findUnique({
        where: { id: studentProfileId },
        include: { user: { select: { id: true, fullName: true } } },
      });
      if (!studentProfile) {
        throw ApiError.notFound('بروفايل الطالب غير موجود');
      }

      // 2. Verify Source Enrollment
      const sourceEnrollment = await tx.groupEnrollment.findFirst({
        where: { studentId: studentProfileId, groupId: fromGroupId, status: 'ACTIVE' },
        include: { group: { select: { id: true, name: true } } },
      });
      if (!sourceEnrollment) {
        throw ApiError.badRequest('الطالب ليس مسجلاً كنشط في المجموعة السابقة المحددة');
      }

      // 3. Verify Destination Group & Capacity
      const destGroup = await tx.group.findUnique({
        where: { id: toGroupId },
        include: {
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
      });
      if (!destGroup || !destGroup.isActive) {
        throw ApiError.badRequest('المجموعة الجديدة غير موجودة أو غير مفعلة');
      }

      if (destGroup._count.enrollments >= destGroup.maxCapacity) {
        throw ApiError.badRequest('عذراً، المجموعة الجديدة ممتلئة بالكامل');
      }

      // 4. Check if student already has active enrollment in destination
      const existingDestEnrollment = await tx.groupEnrollment.findFirst({
        where: { studentId: studentProfileId, groupId: toGroupId },
      });
      if (existingDestEnrollment && existingDestEnrollment.status === 'ACTIVE') {
        throw ApiError.conflict('الطالب مسجل بالفعل كنشط في المجموعة الجديدة');
      }

      // 5. Update Source Enrollment to 'TRANSFERRED' (Preserving historical link)
      await tx.groupEnrollment.update({
        where: { id: sourceEnrollment.id },
        data: { status: 'TRANSFERRED' },
      });

      // 6. Create or Activate Enrollment in Destination Group
      let newEnrollment;
      if (existingDestEnrollment) {
        newEnrollment = await tx.groupEnrollment.update({
          where: { id: existingDestEnrollment.id },
          data: { status: 'ACTIVE', joinedAt: new Date(), addedBy: adminId },
        });
      } else {
        newEnrollment = await tx.groupEnrollment.create({
          data: {
            studentId: studentProfileId,
            groupId: toGroupId,
            status: 'ACTIVE',
            enrollmentPrice: destGroup.defaultPrice,
            addedBy: adminId,
          },
        });
      }

      // 7. Record Audit Log
      await tx.auditLog.create({
        data: {
          adminId,
          action: 'STUDENT_TRANSFERRED',
          resource: 'ENROLLMENT',
          resourceId: newEnrollment.id,
          reason,
          metadata: JSON.stringify({
            studentName: studentProfile.user.fullName,
            fromGroupId,
            fromGroupName: sourceEnrollment.group.name,
            toGroupId,
            toGroupName: destGroup.name,
          }),
        },
      });

      // 8. In-App Notification & Socket.IO Alert
      const notifTitle = '🔄 تم نقلك إلى مجموعة دراسية جديدة';
      const notifBody = `قامت إدارة المنصة بنقلك من مجموعة "${sourceEnrollment.group.name}" إلى مجموعة "${destGroup.name}".`;

      await tx.notification.create({
        data: {
          userId: studentProfile.user.id,
          title: notifTitle,
          body: notifBody,
          type: 'ANNOUNCEMENT',
          referenceId: toGroupId,
        },
      });

      try {
        const io = getIO();
        io.to(`user:${studentProfile.user.id}`).emit('notification:new', {
          title: notifTitle,
          body: notifBody,
          type: 'ANNOUNCEMENT',
          referenceId: toGroupId,
          createdAt: new Date(),
        });
      } catch (_) {}

      return {
        message: 'تم نقل الطالب بنجاح بين المجموعتين',
        student: { id: studentProfile.user.id, fullName: studentProfile.user.fullName },
        fromGroup: { id: sourceEnrollment.group.id, name: sourceEnrollment.group.name },
        toGroup: { id: destGroup.id, name: destGroup.name },
      };
    });
  }
}
