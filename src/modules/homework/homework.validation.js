import Joi from 'joi';

export const submitHomeworkSchema = Joi.object({
  answers: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().uuid().optional(),
        questionOrder: Joi.number().integer().min(1).optional(),
        selectedOption: Joi.number().integer().min(0).allow(null).optional(),
        essayText: Joi.string().allow('', null).optional(),
        timeSpentSeconds: Joi.number().min(0).optional(),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'يجب إرسال إجابة واحدة على الأقل',
      'any.required': 'قائمة الإجابات مطلوبة',
    }),
  timeAnalytics: Joi.object({
    averageTimePerQuestionSec: Joi.number().min(0).optional(),
    fastestQuestionSec: Joi.number().min(0).optional(),
    slowestQuestionSec: Joi.number().min(0).optional(),
  }).optional(),
});
