import Joi from 'joi';

export const createConversationSchema = Joi.object({
  groupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة غير صالح',
    'any.required': 'معرف المجموعة مطلوب لبدء المحادثة',
  }),
});

export const sendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(5000).optional().messages({
    'string.empty': 'محتوى الرسالة لا يمكن أن يكون فارغاً',
    'string.max': 'محتوى الرسالة لا يمكن أن يتجاوز 5000 حرف',
  }),
  message: Joi.string().trim().min(1).max(5000).optional().messages({
    'string.empty': 'محتوى الرسالة لا يمكن أن يكون فارغاً',
    'string.max': 'محتوى الرسالة لا يمكن أن يتجاوز 5000 حرف',
  }),
  attachmentUrl: Joi.string().allow('', null).optional(),
}).or('content', 'message').messages({
  'object.missing': 'محتوى الرسالة مطلوب (content أو message)',
});

export const markReadSchema = Joi.object({
  conversationId: Joi.string().uuid().optional(),
});
