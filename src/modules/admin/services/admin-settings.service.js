import prisma from '../../../config/prisma.js';
import { AdminAuditService } from './admin-audit.service.js';
import { invalidateMaintenanceCache } from '../../../middlewares/maintenance.middleware.js';

export class AdminSettingsService {
  /**
   * Get Platform Settings (Singleton)
   */
  static async getSettings() {
    return prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        maintenanceMode: false,
        registrationOpen: true,
        supportEmail: 'support@eureka-lms.com',
        supportPhone: '+201000000000',
      },
    });
  }

  /**
   * Update Platform Settings
   */
  static async updateSettings(adminId, data) {
    const updated = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(data.maintenanceMode !== undefined && { maintenanceMode: Boolean(data.maintenanceMode) }),
        ...(data.registrationOpen !== undefined && { registrationOpen: Boolean(data.registrationOpen) }),
        ...(data.supportEmail !== undefined && { supportEmail: data.supportEmail }),
        ...(data.supportPhone !== undefined && { supportPhone: data.supportPhone }),
      },
      create: {
        id: 'default',
        maintenanceMode: Boolean(data.maintenanceMode ?? false),
        registrationOpen: Boolean(data.registrationOpen ?? true),
        supportEmail: data.supportEmail || 'support@eureka-lms.com',
        supportPhone: data.supportPhone || '+201000000000',
      },
    });

    invalidateMaintenanceCache();

    await AdminAuditService.logAction({
      adminId,
      action: 'SETTINGS_UPDATED',
      resource: 'SYSTEM',
      resourceId: 'default',
      metadata: data,
    });

    return updated;
  }
}
