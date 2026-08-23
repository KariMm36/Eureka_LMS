import { AcademicService } from './academic.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class AcademicController {
  static async getStages(req, res, next) {
    try {
      const stages = await AcademicService.getAllStages();
      return ApiResponse.success(res, stages, 'قائمة المراحل التعليمية والصفوف الدراسية');
    } catch (error) {
      next(error);
    }
  }

  static async getSubjects(req, res, next) {
    try {
      const { gradeLevelId } = req.query;
      const subjects = await AcademicService.getSubjects(gradeLevelId);
      return ApiResponse.success(res, subjects, 'قائمة المواد الدراسية');
    } catch (error) {
      next(error);
    }
  }

  static async getSubjectUnits(req, res, next) {
    try {
      const { subjectId } = req.params;
      const { gradeLevelId } = req.query;
      const result = await AcademicService.getSubjectUnits(subjectId, gradeLevelId);
      return ApiResponse.success(res, result, 'قائمة الوحدات والدروس');
    } catch (error) {
      next(error);
    }
  }

  static async getLessonDetails(req, res, next) {
    try {
      const { lessonId } = req.params;
      const lesson = await AcademicService.getLessonDetails(lessonId);
      return ApiResponse.success(res, lesson, 'تفاصيل الدرس والفيديوهات والمرفقات');
    } catch (error) {
      next(error);
    }
  }
}
