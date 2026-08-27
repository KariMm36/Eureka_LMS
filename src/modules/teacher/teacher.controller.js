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

  // ----------------------------------------------------
  // Milestone 3: Assessment Authoring Wizards & Grading Handlers
  // ----------------------------------------------------

  static async createHomework(req, res, next) {
    try {
      const data = await TeacherService.createHomework(req.user.id, req.body);
      return ApiResponse.created(res, data, 'تم إنشاء ونشر الواجب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherHomeworks(req, res, next) {
    try {
      const data = await TeacherService.getTeacherHomeworks(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب قائمة الواجبات بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getHomeworkDetails(req, res, next) {
    try {
      const data = await TeacherService.getHomeworkDetails(req.user.id, req.params.homeworkId);
      return ApiResponse.success(res, data, 'تم جلب تفاصيل الواجب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateHomework(req, res, next) {
    try {
      const data = await TeacherService.updateHomework(req.user.id, req.params.homeworkId, req.body);
      return ApiResponse.success(res, data, 'تم تحديث الواجب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async deleteHomework(req, res, next) {
    try {
      const data = await TeacherService.deleteHomework(req.user.id, req.params.homeworkId);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async getHomeworkSubmissions(req, res, next) {
    try {
      const data = await TeacherService.getHomeworkSubmissions(req.user.id, req.params.homeworkId);
      return ApiResponse.success(res, data, 'تم جلب تسليمات الواجب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async createExam(req, res, next) {
    try {
      const data = await TeacherService.createExam(req.user.id, req.body);
      return ApiResponse.created(res, data, 'تم إنشاء ونشر الامتحان بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherExams(req, res, next) {
    try {
      const data = await TeacherService.getTeacherExams(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب قائمة الامتحانات بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getExamDetails(req, res, next) {
    try {
      const data = await TeacherService.getExamDetails(req.user.id, req.params.examId);
      return ApiResponse.success(res, data, 'تم جلب تفاصيل الامتحان بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async updateExam(req, res, next) {
    try {
      const data = await TeacherService.updateExam(req.user.id, req.params.examId, req.body);
      return ApiResponse.success(res, data, 'تم تحديث الامتحان بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async deleteExam(req, res, next) {
    try {
      const data = await TeacherService.deleteExam(req.user.id, req.params.examId);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async getExamAttempts(req, res, next) {
    try {
      const data = await TeacherService.getExamAttempts(req.user.id, req.params.examId);
      return ApiResponse.success(res, data, 'تم جلب محاولات الامتحان بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getPendingEssayGrading(req, res, next) {
    try {
      const data = await TeacherService.getPendingEssayGrading(req.user.id);
      return ApiResponse.success(res, data, 'تم جلب قائمة الأسئلة المقالية بانتظار التصحيح');
    } catch (error) {
      next(error);
    }
  }

  static async gradeEssay(req, res, next) {
    try {
      const data = await TeacherService.gradeEssay(req.user.id, req.body);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async getExamGradeSheet(req, res, next) {
    try {
      const data = await TeacherService.getExamGradeSheet(req.user.id, req.params.examId);
      return ApiResponse.success(res, data, 'تم جلب كشف درجات الطلاب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  // ----------------------------------------------------
  // Milestone 4: Finance Ledger & Broadcast Handlers
  // ----------------------------------------------------

  static async getFinanceSummary(req, res, next) {
    try {
      const data = await TeacherService.getFinanceSummary(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب الملخص المالي بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getGroupFinanceRoster(req, res, next) {
    try {
      const data = await TeacherService.getGroupFinanceRoster(req.user.id, req.params.groupId, req.query);
      return ApiResponse.success(res, data, 'تم جلب سجل مصروفات المجموعة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async recordStudentPayment(req, res, next) {
    try {
      const data = await TeacherService.recordStudentPayment(req.user.id, req.body, req.file);
      return ApiResponse.created(res, data, 'تم تسجيل إيصال السداد بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentLedger(req, res, next) {
    try {
      const data = await TeacherService.getPaymentLedger(req.user.id, req.query);
      return ApiResponse.success(res, data, 'تم جلب سجل المدفوعات بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async deletePaymentReceipt(req, res, next) {
    try {
      const data = await TeacherService.deletePaymentReceipt(req.user.id, req.params.paymentId);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }

  static async broadcastNotification(req, res, next) {
    try {
      const data = await TeacherService.broadcastNotification(req.user.id, req.body);
      return ApiResponse.success(res, data, data.message);
    } catch (error) {
      next(error);
    }
  }
}



