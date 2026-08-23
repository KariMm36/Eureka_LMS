import { HomeService } from './home.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class HomeController {
  static async getHomeFeed(req, res, next) {
    try {
      const feed = await HomeService.getHomeDashboard(req.user.id);
      return ApiResponse.success(res, feed, 'بيانات الصفحة الرئيسية');
    } catch (error) {
      next(error);
    }
  }
}
