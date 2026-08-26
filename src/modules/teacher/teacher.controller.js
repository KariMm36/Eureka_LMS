import { TeacherService } from './teacher.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class TeacherController {
  static async getDashboard(req, res, next) {
    try {
      const data = await TeacherService.getDashboard(req.user.id);
      return ApiResponse.success(res, data, 'تم جلب بيانات لوحة تحكم المعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getGroups(req, res, next) {
    try {
      const data = await TeacherService.getTeacherGroups(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب مجموعات المعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async createGroup(req, res, next) {
    try {
      const data = await TeacherService.createGroup(req.user.id, req.body, req.file);
      return ApiResponse.created(res, data, 'تم إنشاء المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getGroupById(req, res, next) {
    try {
      const data = await TeacherService.getGroupById(req.user.id, req.params.groupId);
      return ApiResponse.success(res, data, 'تم جلب تفاصيل المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateGroup(req, res, next) {
    try {
      const data = await TeacherService.updateGroup(req.user.id, req.params.groupId, req.body, req.file);
      return ApiResponse.success(res, data, 'تم تحديث بيانات المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async deleteGroup(req, res, next) {
    try {
      const data = await TeacherService.deleteGroup(req.user.id, req.params.groupId);
      return ApiResponse.success(res, data, 'تم تعطيل المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getGroupStudents(req, res, next) {
    try {
      const data = await TeacherService.getGroupStudents(req.user.id, req.params.groupId, req.query);
      return ApiResponse.success(res, data, 'تم جلب قائمة طلاب المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async addStudentToGroup(req, res, next) {
    try {
      const data = await TeacherService.addStudentToGroup(req.user.id, req.params.groupId, req.body);
      return ApiResponse.created(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async getStudentDetails(req, res, next) {
    try {
      const data = await TeacherService.getStudentDetails(req.user.id, req.params.studentId);
      return ApiResponse.success(res, data, 'تم جلب تفاصيل الطالب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateStudent(req, res, next) {
    try {
      const data = await TeacherService.updateStudentInGroup(req.user.id, req.params.studentId, req.body);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async getGroupQrCode(req, res, next) {
    try {
      const data = await TeacherService.getGroupQrCode(req.user.id, req.params.groupId);
      return ApiResponse.success(res, data, 'تم إنشاء رمز QR للمجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const data = await TeacherService.getProfile(req.user.id);
      return ApiResponse.success(res, data, 'تم جلب الملف الشخصي للمعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const data = await TeacherService.updateProfile(req.user.id, req.body, req.file);
      return ApiResponse.success(res, data, 'تم تحديث بيانات المعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req, res, next) {
    try {
      const data = await TeacherService.updateSettings(req.user.id, req.body);
      return ApiResponse.success(res, data, 'تم حفظ إعدادات المعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  // ----------------------------------------------------
  // 12. Attendance & QR Roll-Call
  // ----------------------------------------------------

  static async createAttendanceSession(req, res, next) {
    try {
      const data = await TeacherService.createAttendanceSession(req.user.id, req.body);
      return ApiResponse.created(res, data, 'تم إنشاء جلسة الحضور بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async generateSessionQr(req, res, next) {
    try {
      const data = await TeacherService.generateSessionQr(req.user.id, req.params.sessionId);
      return ApiResponse.success(res, data, 'تم توليد رمز QR وكود الجلسة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async recordStudentAttendance(req, res, next) {
    try {
      const data = await TeacherService.recordStudentAttendance(req.user.id, req.body);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async manualAttendance(req, res, next) {
    try {
      const data = await TeacherService.manualAttendance(req.user.id, req.params.sessionId, req.body.attendances);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async getSessionDetails(req, res, next) {
    try {
      const data = await TeacherService.getSessionDetails(req.user.id, req.params.sessionId);
      return ApiResponse.success(res, data, 'تم جلب تقرير تفاصيل الجلسة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getAttendanceOverview(req, res, next) {
    try {
      const data = await TeacherService.getAttendanceOverview(req.user.id);
      return ApiResponse.success(res, data, 'تم جلب ملخص الحضور والغياب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getAttendanceCalendar(req, res, next) {
    try {
      const data = await TeacherService.getAttendanceCalendar(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب تقويم الجلسات بنجاح');
    } catch (error) {
      next(error);
    }
  }

  // ----------------------------------------------------
  // 13. Curriculum Content CRUD
  // ----------------------------------------------------

  static async createSubject(req, res, next) {
    try {
      const data = await TeacherService.createSubject(req.user.id, req.body, req.file);
      return ApiResponse.created(res, data, 'تم إنشاء المادة الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherSubjects(req, res, next) {
    try {
      const data = await TeacherService.getTeacherSubjects(req.user.id);
      return ApiResponse.success(res, data, 'تم جلب المواد الدراسية للمعلم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async createUnit(req, res, next) {
    try {
      const data = await TeacherService.createUnit(req.user.id, req.body);
      return ApiResponse.created(res, data, 'تم إنشاء الوحدة الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateUnit(req, res, next) {
    try {
      const data = await TeacherService.updateUnit(req.user.id, req.params.unitId, req.body);
      return ApiResponse.success(res, data, 'تم تحديث الوحدة الدراسية بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async deleteUnit(req, res, next) {
    try {
      const data = await TeacherService.deleteUnit(req.user.id, req.params.unitId);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async createLesson(req, res, next) {
    try {
      const data = await TeacherService.createLesson(req.user.id, req.body);
      return ApiResponse.created(res, data, 'تم إنشاء الدرس بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateLesson(req, res, next) {
    try {
      const data = await TeacherService.updateLesson(req.user.id, req.params.lessonId, req.body);
      return ApiResponse.success(res, data, 'تم تحديث الدرس بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async deleteLesson(req, res, next) {
    try {
      const data = await TeacherService.deleteLesson(req.user.id, req.params.lessonId);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async uploadLessonVideo(req, res, next) {
    try {
      const data = await TeacherService.uploadLessonVideo(req.user.id, req.params.lessonId, req.body, req.file);
      return ApiResponse.created(res, data, 'تم رفع فيديو الدرس بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async uploadLessonMaterial(req, res, next) {
    try {
      const data = await TeacherService.uploadLessonMaterial(req.user.id, req.params.lessonId, req.body, req.file);
      return ApiResponse.created(res, data, 'تم رفع المستند التعليمي بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async deleteLessonMedia(req, res, next) {
    try {
      const data = await TeacherService.deleteLessonMedia(req.user.id, req.params.lessonId, req.params.mediaType, req.params.mediaId);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }
}

