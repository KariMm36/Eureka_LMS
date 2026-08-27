import Joi from 'joi';

export const registerFcmTokenSchema = Joi.object({
  fcmToken: Joi.string().trim().min(5).max(500).required().messages({
    'string.empty': 'رمز جهاز الإشعارات FCM مطلوب',
    'any.required': 'رمز جهاز الإشعارات FCM مطلوب',
  }),
});
