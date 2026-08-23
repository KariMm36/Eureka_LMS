import { ExamService } from './exam.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class ExamController {
  static async getExamsFeed(req, res, next) {
    try {
      const { tab } = req.query; // all | available | completed | upcoming
      const exams = await ExamService.getStudentExamsFeed(req.user.id, tab);
      return ApiResponse.success(res, exams, 'قائمة الامتحانات والاختبارات');
    } catch (error) {
      next(error);
    }
  }

  static async getExamInstructions(req, res, next) {
    try {
      const { examId } = req.params;
      const instructions = await ExamService.getExamInstructions(req.user.id, examId);
      return ApiResponse.success(res, instructions, 'إرشادات وضوابط الامتحان');
    } catch (error) {
      next(error);
    }
  }

  static async startExam(req, res, next) {
    try {
      const { examId } = req.params;
      const session = await ExamService.startExam(req.user.id, examId);
      return ApiResponse.success(res, session, 'بدء جلسة الامتحان');
    } catch (error) {
      next(error);
    }
  }

  static async submitExam(req, res, next) {
    try {
      const { examId } = req.params;
      const result = await ExamService.submitExam(req.user.id, examId, req.body);
      return ApiResponse.success(res, result, 'تم إنهاء الامتحان واحتساب الدرجة');
    } catch (error) {
      next(error);
    }
  }

  static async getExamResult(req, res, next) {
    try {
      const { examId } = req.params;
      const result = await ExamService.getExamResult(req.user.id, examId);
      return ApiResponse.success(res, result, 'تقرير نتيجة الامتحان');
    } catch (error) {
      next(error);
    }
  }
}
