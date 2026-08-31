import { ApiResponse } from '../../utils/apiResponse.js';
import { AdminDashboardService } from './services/admin-dashboard.service.js';
import { AdminUsersService } from './services/admin-users.service.js';
import { AdminTeachersService } from './services/admin-teachers.service.js';
import { AdminStudentsService } from './services/admin-students.service.js';
import { AdminGroupsService } from './services/admin-groups.service.js';
import { AdminEnrollmentService } from './services/admin-enrollment.service.js';
import { AdminAcademicService } from './services/admin-academic.service.js';
import { AdminAttendanceService } from './services/admin-attendance.service.js';
import { AdminFinanceService } from './services/admin-finance.service.js';
import { AdminNotificationService } from './services/admin-notification.service.js';
import { AdminSettingsService } from './services/admin-settings.service.js';
import { AdminAuditService } from './services/admin-audit.service.js';

export class AdminController {
  // 1. Dashboard
  static async getDashboard(req, res, next) {
    try {
      const result = await AdminDashboardService.getDashboardKPIs();
      return ApiResponse.success(res, result, 'لوحة تحكم المشرف العام');
    } catch (error) {
      next(error);
    }
  }

  // 2. Users Management
  static async getUsers(req, res, next) {
    try {
      const { role, status, search, page, limit, sortBy, sortOrder } = req.query;
      const result = await AdminUsersService.getUsersList({ role, status, search, page, limit, sortBy, sortOrder });
      return ApiResponse.success(res, result, 'قائمة المستخدمين');
    } catch (error) {
      next(error);
    }
  }

  static async getUserDetails(req, res, next) {
    try {
      const { id } = req.params;
      const user = await AdminUsersService.getUserDetails(id);
      return ApiResponse.success(res, user, 'تفاصيل المستخدم');
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive, reason } = req.body;
      const result = await AdminUsersService.updateUserStatus(req.user.id, id, { isActive, reason });
      return ApiResponse.success(res, result, isActive ? 'تم تفعيل الحساب بنجاح' : 'تم تعطيل الحساب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async changeUserRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role, reason } = req.body;
      const result = await AdminUsersService.changeUserRole(req.user.id, id, { role, reason });
      return ApiResponse.success(res, result, 'تم تغيير دور المستخدم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async forceLogoutUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminUsersService.forceLogoutUser(req.user.id, id);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async adminResetPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { newPassword, reason } = req.body;
      const result = await AdminUsersService.adminResetPassword(req.user.id, id, { newPassword, reason });
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async exportUsers(req, res, next) {
    try {
      const csv = await AdminUsersService.exportUsersCSV();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="eureka_users.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  // 3. Teachers Administration
  static async getPendingTeachers(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await AdminTeachersService.getPendingTeachers({ page, limit });
      return ApiResponse.success(res, result, 'قائمة المعلمين بانتظار الاعتماد');
    } catch (error) {
      next(error);
    }
  }

  static async approveTeacher(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminTeachersService.approveTeacher(req.user.id, id);
      return ApiResponse.success(res, result, 'تم اعتماد وتوثيق حساب المعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async rejectTeacher(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await AdminTeachersService.rejectTeacher(req.user.id, id, { reason });
      return ApiResponse.success(res, result, 'تم رفض وتعطيل حساب المعلم');
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherStats(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminTeachersService.getTeacherStats(id);
      return ApiResponse.success(res, result, 'إحصائيات وأداء المعلم');
    } catch (error) {
      next(error);
    }
  }

  // 4. Students Administration
  static async getStudentHistory(req, res, next) {
    try {
      const { id } = req.params; // studentProfileId
      const result = await AdminStudentsService.getStudentAcademicHistory(id);
      return ApiResponse.success(res, result, 'السجل الأكاديمي الشامل للطالب');
    } catch (error) {
      next(error);
    }
  }

  // 5. Groups Oversight
  static async getGroups(req, res, next) {
    try {
      const { search, stageId, gradeLevelId, teacherId, isActive, page, limit } = req.query;
      const result = await AdminGroupsService.getGroupsList({ search, stageId, gradeLevelId, teacherId, isActive, page, limit });
      return ApiResponse.success(res, result, 'دليل المجموعات الدراسية');
    } catch (error) {
      next(error);
    }
  }

  static async getGroupDetails(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminGroupsService.getGroupDetails(id);
      return ApiResponse.success(res, result, 'تفاصيل المجموعة وسجل الطلاب');
    } catch (error) {
      next(error);
    }
  }

  static async toggleGroupStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive, reason } = req.body;
      const result = await AdminGroupsService.toggleGroupStatus(req.user.id, id, { isActive, reason });
      return ApiResponse.success(res, result, isActive ? 'تم تفعيل المجموعة بنجاح' : 'تم تعطيل المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async assignGroupTeacher(req, res, next) {
    try {
      const { id } = req.params;
      const { teacherId, reason } = req.body;
      const result = await AdminGroupsService.assignGroupTeacher(req.user.id, id, { teacherId, reason });
      return ApiResponse.success(res, result, 'تمت إعادة تعيين المعلم للمجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  // 6. Enrollment & Transfers
  static async manualEnroll(req, res, next) {
    try {
      const { studentProfileId, groupId, enrollmentPrice, reason } = req.body;
      const result = await AdminEnrollmentService.manualEnrollStudent(req.user.id, { studentProfileId, groupId, enrollmentPrice, reason });
      return ApiResponse.success(res, result, 'تم تسجيل الطالب في المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async transferStudent(req, res, next) {
    try {
      const { studentProfileId, fromGroupId, toGroupId, reason } = req.body;
      const result = await AdminEnrollmentService.transferStudentGroup(req.user.id, { studentProfileId, fromGroupId, toGroupId, reason });
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // 7. Academic Catalogue
  static async createStage(req, res, next) {
    try {
      const result = await AdminAcademicService.createStage(req.user.id, req.body);
      return ApiResponse.created(res, result, 'تم إنشاء المرحلة الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateStage(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminAcademicService.updateStage(req.user.id, id, req.body);
      return ApiResponse.success(res, result, 'تم تحديث المرحلة الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async createSubject(req, res, next) {
    try {
      const result = await AdminAcademicService.createSubject(req.user.id, req.body, req.file);
      return ApiResponse.created(res, result, 'تم إنشاء المادة الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateSubject(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminAcademicService.updateSubject(req.user.id, id, req.body, req.file);
      return ApiResponse.success(res, result, 'تم تحديث المادة الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async archiveSubject(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AdminAcademicService.archiveSubject(req.user.id, id);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // 8. Attendance Administration
  static async getAttendanceOverview(req, res, next) {
    try {
      const result = await AdminAttendanceService.getAttendanceOverview();
      return ApiResponse.success(res, result, 'إحصائيات الحضور والغياب العامة');
    } catch (error) {
      next(error);
    }
  }

  static async getAtRiskStudents(req, res, next) {
    try {
      const { threshold, page, limit } = req.query;
      const result = await AdminAttendanceService.getAtRiskStudents({ threshold, page, limit });
      return ApiResponse.success(res, result, 'قائمة الطلاب المعرضين للخطر (نسبة الحضور منخفضة)');
    } catch (error) {
      next(error);
    }
  }

  static async exportAttendance(req, res, next) {
    try {
      const csv = await AdminAttendanceService.exportAttendanceCSV();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="eureka_attendance.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  // 9. Finance Administration
  static async getFinanceSummary(req, res, next) {
    try {
      const result = await AdminFinanceService.getFinancialSummary();
      return ApiResponse.success(res, result, 'ملخص الإيرادات والعمليات المالية');
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentsList(req, res, next) {
    try {
      const { status, groupId, page, limit } = req.query;
      const result = await AdminFinanceService.getPaymentsList({ status, groupId, page, limit });
      return ApiResponse.success(res, result, 'سجل المدفوعات والتحصيلات');
    } catch (error) {
      next(error);
    }
  }

  static async getUnpaidStudents(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await AdminFinanceService.getUnpaidStudents({ page, limit });
      return ApiResponse.success(res, result, 'قائمة الطلاب المتأخرين عن السداد');
    } catch (error) {
      next(error);
    }
  }

  static async exportFinance(req, res, next) {
    try {
      const csv = await AdminFinanceService.exportFinancialCSV();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="eureka_finance.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  // 10. Global Broadcasts
  static async sendBroadcast(req, res, next) {
    try {
      const { targetAudience, title, message, type } = req.body;
      const result = await AdminNotificationService.sendPlatformBroadcast(req.user.id, { targetAudience, title, message, type });
      return ApiResponse.success(res, result, 'تم إرسال الإشعار العام بنجاح');
    } catch (error) {
      next(error);
    }
  }

  // 11. Platform Settings
  static async getSettings(req, res, next) {
    try {
      const result = await AdminSettingsService.getSettings();
      return ApiResponse.success(res, result, 'إعدادات المنصة العامة');
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req, res, next) {
    try {
      const result = await AdminSettingsService.updateSettings(req.user.id, req.body);
      return ApiResponse.success(res, result, 'تم تحديث إعدادات المنصة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  // 12. Audit Logs
  static async getAuditLogs(req, res, next) {
    try {
      const { action, resource, adminId, page, limit } = req.query;
      const result = await AdminAuditService.getAuditLogs({ action, resource, adminId, page, limit });
      return ApiResponse.success(res, result, 'سجلات التدقيق الإداري');
    } catch (error) {
      next(error);
    }
  }
}
