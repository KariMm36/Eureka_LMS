import Joi from 'joi';

export const joinByCodeSchema = Joi.object({
  groupCode: Joi.string().trim().required().messages({
    'string.empty': 'يرجى إدخال كود المجموعة',
    'any.required': 'كود المجموعة مطلوب',
  }),
});
