import { GroupService } from './group.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';

export class GroupController {
  static async searchGroups(req, res, next) {
    try {
      const { query, subjectId, stageId, gradeLevelId } = req.query;
      const groups = await GroupService.searchGroups({ query, subjectId, stageId, gradeLevelId });
      return ApiResponse.success(res, groups, 'قائمة المجموعات المتاحة');
    } catch (error) {
      next(error);
    }
  }

  static async previewGroupByCode(req, res, next) {
    try {
      const { groupCode } = req.params;
      const group = await GroupService.previewGroupByCode(groupCode);
      return ApiResponse.success(res, group, 'بيانات المجموعة');
    } catch (error) {
      next(error);
    }
  }

  static async joinGroupByCode(req, res, next) {
    try {
      const { groupCode } = req.body;
      const result = await GroupService.joinGroupByCode(req.user.id, groupCode);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async joinGroupById(req, res, next) {
    try {
      const { groupId } = req.params;
      const result = await GroupService.joinGroupById(req.user.id, groupId);
      return ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getMyGroups(req, res, next) {
    try {
      const groups = await GroupService.getMyGroups(req.user.id);
      return ApiResponse.success(res, groups, 'المجموعات المنضم إليها الطالب');
    } catch (error) {
      next(error);
    }
  }

  static async getGroupDetails(req, res, next) {
    try {
      const { groupId } = req.params;
      const group = await GroupService.getGroupDetails(req.user.id, groupId);
      return ApiResponse.success(res, group, 'تفاصيل المجموعة');
    } catch (error) {
      next(error);
    }
  }
}
