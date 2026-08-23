import { StudentService } from './student.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class StudentController {
  static async completeOnboarding(req, res, next) {
    try {
      const result = await StudentService.completeOnboarding(req.user.id, req.body);
      return ApiResponse.success(res, result, 'تم إكمال إعداد الحساب واختيار المواد بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const result = await StudentService.getStudentProfile(req.user.id);
      return ApiResponse.success(res, result, 'بيانات الملف الشخصي للطالب');
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const avatarUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
      const payload = { ...req.body, ...(avatarUrl && { avatarUrl }) };
      const result = await StudentService.updateProfile(req.user.id, payload);
      return ApiResponse.success(res, result, 'تم تحديث البيانات الشخصية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateSubjects(req, res, next) {
    try {
      const result = await StudentService.updateSelectedSubjects(
        req.user.id,
        req.body.selectedSubjectIds
      );
      return ApiResponse.success(res, result, 'تم تحديث قائمة المواد الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req, res, next) {
    try {
      const result = await StudentService.updateSettings(req.user.id, req.body);
      return ApiResponse.success(res, result, 'تم حفظ الإعدادات بنجاح');
    } catch (error) {
      next(error);
    }
  }
}
