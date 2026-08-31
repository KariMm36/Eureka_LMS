import Joi from 'joi';

export const registerFcmTokenSchema = Joi.object({
  fcmToken: Joi.string().trim().min(5).max(500).required().messages({
    'string.empty': 'رمز جهاز الإشعارات FCM مطلوب',
    'any.required': 'رمز جهاز الإشعارات FCM مطلوب',
  }),
});

export const sendGroupNotificationSchema = Joi.object({
  groupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة غير صالح',
    'any.required': 'معرف المجموعة مطلوب',
  }),
  title: Joi.string().trim().min(1).max(191).required().messages({
    'string.empty': 'عنوان الإشعار لا يمكن أن يكون فارغاً',
    'string.max': 'عنوان الإشعار لا يمكن أن يتجاوز 191 حرفاً',
    'any.required': 'عنوان الإشعار مطلوب',
  }),
  message: Joi.string().trim().min(1).max(5000).optional(),
  body: Joi.string().trim().min(1).max(5000).optional(),
  type: Joi.string().valid('ANNOUNCEMENT', 'HOMEWORK', 'EXAM', 'LESSON', 'GROUP_ANNOUNCEMENT').default('ANNOUNCEMENT'),
}).or('message', 'body').messages({
  'object.missing': 'نص الإشعار مطلوب (حقل message أو body)',
});
