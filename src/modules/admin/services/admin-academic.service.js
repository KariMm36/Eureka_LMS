import prisma from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';
import { AdminAuditService } from './admin-audit.service.js';
import { handleFileUpload, CLOUDINARY_FOLDERS } from '../../../config/cloudinary.config.js';

export class AdminAcademicService {
  /**
   * 1. Create New Educational Stage
   */
  static async createStage(adminId, { key, nameAr, nameEn, order = 1 }) {
    const existing = await prisma.stage.findUnique({ where: { key } });
    if (existing) {
      throw ApiError.conflict('رمز المرحلة الدراسية مسجل مسبقاً');
    }

    const stage = await prisma.stage.create({
      data: {
        key,
        nameAr,
        nameEn,
        order: parseInt(order, 10) || 1,
      },
    });

    await AdminAuditService.logAction({
      adminId,
      action: 'STAGE_CREATED',
      resource: 'STAGE',
      resourceId: stage.id,
      metadata: { key, nameAr, nameEn },
    });

    return stage;
  }

  /**
   * 2. Update Stage Details
   */
  static async updateStage(adminId, stageId, data) {
    const stage = await prisma.stage.findUnique({ where: { id: stageId } });
    if (!stage) {
      throw ApiError.notFound('المرحلة الدراسية غير موجودة');
    }

    const updated = await prisma.stage.update({
      where: { id: stageId },
      data: {
        ...(data.nameAr && { nameAr: data.nameAr }),
        ...(data.nameEn && { nameEn: data.nameEn }),
        ...(data.order !== undefined && { order: parseInt(data.order, 10) }),
      },
    });

    await AdminAuditService.logAction({
      adminId,
      action: 'STAGE_UPDATED',
      resource: 'STAGE',
      resourceId: stageId,
      metadata: data,
    });

    return updated;
  }

  /**
   * 3. Create Core Subject with Icon Upload
   */
  static async createSubject(adminId, { nameAr, nameEn }, iconFile = null) {
    let iconUrl = 'default-subject.png';
    if (iconFile) {
      iconUrl = await handleFileUpload({
        file: iconFile,
        folder: CLOUDINARY_FOLDERS.SUBJECT_ICONS,
        resourceType: 'image',
      });
    }

    const subject = await prisma.subject.create({
      data: {
        nameAr,
        nameEn,
        iconUrl: iconUrl || 'default-subject.png',
        createdById: adminId,
        isGlobal: true,
      },
    });

    await AdminAuditService.logAction({
      adminId,
      action: 'SUBJECT_CREATED',
      resource: 'SUBJECT',
      resourceId: subject.id,
      metadata: { nameAr, nameEn },
    });

    return subject;
  }

  /**
   * 4. Update Subject Details
   */
  static async updateSubject(adminId, subjectId, data, iconFile = null) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw ApiError.notFound('المادة الدراسية غير موجودة');
    }

    let iconUrl = subject.iconUrl;
    if (iconFile) {
      iconUrl = await handleFileUpload({
        file: iconFile,
        folder: CLOUDINARY_FOLDERS.SUBJECT_ICONS,
        resourceType: 'image',
      });
    }

    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(data.nameAr && { nameAr: data.nameAr }),
        ...(data.nameEn && { nameEn: data.nameEn }),
        ...(iconFile && { iconUrl }),
      },
    });

    await AdminAuditService.logAction({
      adminId,
      action: 'SUBJECT_UPDATED',
      resource: 'SUBJECT',
      resourceId: subjectId,
      metadata: data,
    });

    return updated;
  }

  /**
   * 5. Archive Subject (Soft-Deactivate to protect historical tests and lessons)
   */
  static async archiveSubject(adminId, subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw ApiError.notFound('المادة الدراسية غير موجودة');
    }

    await prisma.subject.update({
      where: { id: subjectId },
      data: { isGlobal: false },
    });

    await AdminAuditService.logAction({
      adminId,
      action: 'SUBJECT_ARCHIVED',
      resource: 'SUBJECT',
      resourceId: subjectId,
      metadata: { subjectName: subject.nameAr },
    });

    return { message: 'تم أرشفة المادة الدراسية بنجاح وحفظ السجلات التاريخية المرتبطة بها' };
  }
}
