import Joi from 'joi';

const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;

export const onboardingSchema = Joi.object({
  stageId: Joi.string().required().messages({
    'any.required': 'يرجى اختيار المرحلة الدراسية',
  }),
  gradeLevelId: Joi.string().required().messages({
    'any.required': 'يرجى اختيار الصف الدراسي',
  }),
  selectedSubjectIds: Joi.array().items(Joi.string()).min(1).messages({
    'array.min': 'يرجى اختيار مادة دراسية واحدة على الأقل',
  }),
  subjectIds: Joi.array().items(Joi.string()).min(1).messages({
    'array.min': 'يرجى اختيار مادة دراسية واحدة على الأقل',
  }),
  parentPhone: Joi.string().pattern(egyptianPhoneRegex).allow('', null).messages({
    'string.pattern.base': 'يرجى إدخال رقم هاتف ولي أمر مصري صحيح (مثال: 01020824778)',
  }),
}).or('selectedSubjectIds', 'subjectIds').messages({
  'object.missing': 'يرجى اختيار المواد الدراسية',
});

export const updateProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(100),
  phone: Joi.string().trim().pattern(egyptianPhoneRegex).messages({
    'string.pattern.base': 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01020324779)',
  }),
  parentPhone: Joi.string().pattern(egyptianPhoneRegex).allow('', null).messages({
    'string.pattern.base': 'يرجى إدخال رقم هاتف ولي أمر مصري صحيح (مثال: 01020824778)',
  }),
  gradeLevelId: Joi.string().allow('', null),
  avatarUrl: Joi.string().allow('', null),
});

export const updateSubjectsSchema = Joi.object({
  selectedSubjectIds: Joi.array().items(Joi.string()).min(1).messages({
    'array.min': 'يرجى اختيار مادة دراسية واحدة على الأقل',
  }),
  subjectIds: Joi.array().items(Joi.string()).min(1).messages({
    'array.min': 'يرجى اختيار مادة دراسية واحدة على الأقل',
  }),
}).or('selectedSubjectIds', 'subjectIds').messages({
  'object.missing': 'يرجى تحديد المواد الدراسية',
});


export const updateSettingsSchema = Joi.object({
  appLanguage: Joi.string().valid('ar', 'en', 'fr', 'es'),
  darkMode: Joi.boolean(),
  notifyExams: Joi.boolean(),
  notifySubjects: Joi.boolean(),
  notifyHomework: Joi.boolean(),
  notifyAnnouncements: Joi.boolean(),
  fcmToken: Joi.string().allow('', null),
});
