import { HomeworkService } from './homework.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class HomeworkController {
  static async getHomeworkFeed(req, res, next) {
    try {
      const { status } = req.query; // pending | completed | all
      const homeworkList = await HomeworkService.getStudentHomeworkFeed(req.user.id, status);
      return ApiResponse.success(res, homeworkList, 'قائمة الواجبات المدرسية');
    } catch (error) {
      next(error);
    }
  }

  static async getHomeworkForTaking(req, res, next) {
    try {
      const { homeworkId } = req.params;
      const homework = await HomeworkService.getHomeworkForTaking(req.user.id, homeworkId);
      return ApiResponse.success(res, homework, 'تفاصيل وأسئلة الواجب');
    } catch (error) {
      next(error);
    }
  }

  static async submitHomework(req, res, next) {
    try {
      const { homeworkId } = req.params;
      const result = await HomeworkService.submitHomework(req.user.id, homeworkId, req.body);
      return ApiResponse.success(res, result, 'تم تسليم الواجب واحتساب النتيجة بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async getHomeworkResult(req, res, next) {
    try {
      const { homeworkId } = req.params;
      const result = await HomeworkService.getHomeworkResult(req.user.id, homeworkId);
      return ApiResponse.success(res, result, 'تقرير نتيجة الواجب ومراجعة الإجابات');
    } catch (error) {
      next(error);
    }
  }
}
