import Joi from 'joi';

export const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'any.required': 'حالة الحساب (isActive) مطلوبة',
  }),
  reason: Joi.string().trim().max(500).optional(),
});

export const changeUserRoleSchema = Joi.object({
  role: Joi.string().valid('STUDENT', 'TEACHER', 'ADMIN').required().messages({
    'any.only': 'الدور غير صالح. الأدوار المتاحة: STUDENT, TEACHER, ADMIN',
    'any.required': 'الدور الجديد مطلوب',
  }),
  reason: Joi.string().trim().max(500).optional(),
});

export const adminResetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(128).required().messages({
    'string.min': 'كلمة المرور يجب أن لا تقل عن 8 أحرف',
    'any.required': 'كلمة المرور الجديدة مطلوبة',
  }),
  reason: Joi.string().trim().max(500).optional(),
});

export const transferEnrollmentSchema = Joi.object({
  studentProfileId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف بروفايل الطالب غير صالح',
    'any.required': 'معرف بروفايل الطالب مطلوب',
  }),
  fromGroupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة السابقة غير صالح',
    'any.required': 'معرف المجموعة السابقة مطلوب',
  }),
  toGroupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة الجديدة غير صالح',
    'any.required': 'معرف المجموعة الجديدة مطلوب',
  }),
  reason: Joi.string().trim().max(500).optional(),
});

export const manualEnrollSchema = Joi.object({
  studentProfileId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف بروفايل الطالب غير صالح',
    'any.required': 'معرف بروفايل الطالب مطلوب',
  }),
  groupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة غير صالح',
    'any.required': 'معرف المجموعة مطلوب',
  }),
  enrollmentPrice: Joi.number().min(0).optional(),
  reason: Joi.string().trim().max(500).optional(),
});

export const createStageSchema = Joi.object({
  key: Joi.string().valid('PRIMARY', 'PREPARATORY', 'SECONDARY').required().messages({
    'any.only': 'رمز المرحلة غير صالح (PRIMARY, PREPARATORY, SECONDARY)',
    'any.required': 'رمز المرحلة مطلوب',
  }),
  nameAr: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'الاسم العربي للمرحلة مطلوب',
  }),
  nameEn: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'الاسم الإنجليزي للمرحلة مطلوب',
  }),
  order: Joi.number().integer().min(1).default(1),
});

export const updateStageSchema = Joi.object({
  nameAr: Joi.string().trim().min(2).max(100).optional(),
  nameEn: Joi.string().trim().min(2).max(100).optional(),
  order: Joi.number().integer().min(1).optional(),
});

export const createSubjectSchema = Joi.object({
  nameAr: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'اسم المادة بالعربية مطلوب',
  }),
  nameEn: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'اسم المادة بالإنجليزية مطلوب',
  }),
  stageId: Joi.string().uuid().optional(),
});

export const updateSubjectSchema = Joi.object({
  nameAr: Joi.string().trim().min(2).max(100).optional(),
  nameEn: Joi.string().trim().min(2).max(100).optional(),
  stageId: Joi.string().uuid().optional(),
  isActive: Joi.boolean().optional(),
});

export const adminBroadcastSchema = Joi.object({
  targetAudience: Joi.string().valid('ALL', 'STUDENTS', 'TEACHERS').required().messages({
    'any.only': 'الجمهور المستهدف غير صالح (ALL, STUDENTS, TEACHERS)',
    'any.required': 'الجمهور المستهدف مطلوب',
  }),
  title: Joi.string().trim().min(2).max(191).required().messages({
    'any.required': 'عنوان الإشعار مطلوب',
  }),
  message: Joi.string().trim().min(2).max(5000).required().messages({
    'any.required': 'نص الإشعار مطلوب',
  }),
  type: Joi.string().valid('ANNOUNCEMENT', 'LESSON', 'EXAM', 'HOMEWORK').default('ANNOUNCEMENT'),
});

export const toggleGroupStatusSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'any.required': 'حالة المجموعة (isActive) مطلوبة',
  }),
  reason: Joi.string().trim().max(500).optional(),
});

export const assignGroupTeacherSchema = Joi.object({
  teacherId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المعلم غير صالح',
    'any.required': 'معرف المعلم الجديد مطلوب',
  }),
  reason: Joi.string().trim().max(500).optional(),
});

export const rejectTeacherSchema = Joi.object({
  reason: Joi.string().trim().max(500).optional(),
});

export const updatePlatformSettingsSchema = Joi.object({
  maintenanceMode: Joi.boolean().optional(),
  registrationOpen: Joi.boolean().optional(),
  supportEmail: Joi.string().email().optional(),
  supportPhone: Joi.string().trim().max(50).optional(),
});
