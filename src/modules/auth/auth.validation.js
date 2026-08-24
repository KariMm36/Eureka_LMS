import Joi from 'joi';

// Egyptian Phone Regex: 010, 011, 012, 015 followed by 8 digits (11 digits total)
const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;

export const registerSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'يرجى إدخال الاسم بالكامل',
    'string.min': 'يجب أن لا يقل الاسم عن 3 أحرف',
    'any.required': 'حقل الاسم مطلوب',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'يرجى إدخال بريد إلكتروني صحيح',
    'string.empty': 'حقل البريد الإلكتروني مطلوب',
    'any.required': 'حقل البريد الإلكتروني مطلوب',
  }),
  phone: Joi.string().trim().pattern(egyptianPhoneRegex).required().messages({
    'string.pattern.base': 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01020324779)',
    'string.empty': 'يرجى إدخال رقم الهاتف',
    'any.required': 'حقل رقم الهاتف مطلوب',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل',
    'string.empty': 'يرجى إدخال كلمة المرور',
    'any.required': 'حقل كلمة المرور مطلوب',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'كلمتا المرور غير متطابقتين',
    'any.required': 'يرجى تأكيد كلمة المرور',
  }),
  role: Joi.string().valid('STUDENT', 'TEACHER').default('STUDENT'),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'يرجى إدخال بريد إلكتروني صحيح',
    'string.empty': 'حقل البريد الإلكتروني مطلوب',
    'any.required': 'حقل البريد الإلكتروني مطلوب',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'يرجى إدخال كلمة المرور',
    'any.required': 'حقل كلمة المرور مطلوب',
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'يرجى إدخال بريد إلكتروني صحيح',
    'string.empty': 'حقل البريد الإلكتروني مطلوب',
    'any.required': 'حقل البريد الإلكتروني مطلوب',
  }),
});

export const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'يرجى إدخال بريد إلكتروني صحيح',
    'any.required': 'حقل البريد الإلكتروني مطلوب',
  }),
  otpCode: Joi.string().length(6).required().messages({
    'string.length': 'رمز التحقق يجب أن يتكون من 6 أرقام',
    'any.required': 'رمز التحقق مطلوب',
  }),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'يرجى إدخال بريد إلكتروني صحيح',
    'any.required': 'حقل البريد الإلكتروني مطلوب',
  }),
  resetToken: Joi.string().required().messages({
    'any.required': 'رمز إعادة التعيين مطلوب',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'يجب أن تحتوي كلمة المرور الجديدة على 6 أحرف على الأقل',
    'any.required': 'كلمة المرور الجديدة مطلوبة',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'كلمتا المرور غير متطابقتين',
    'any.required': 'يرجى تأكيد كلمة المرور الجديدة',
  }),
});

export const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'كلمة المرور الحالية مطلوبة',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'يجب أن تحتوي كلمة المرور الجديدة على 6 أحرف على الأقل',
    'any.required': 'كلمة المرور الجديدة مطلوبة',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'كلمتا المرور غير متطابقتين',
    'any.required': 'يرجى تأكيد كلمة المرور الجديدة',
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'رمز التحديث مطلوب',
    'any.required': 'رمز التحديث مطلوب',
  }),
});

export const verifyEmailSchema = Joi.object({
  otpCode: Joi.string().length(6).required().messages({
    'string.length': 'رمز التحقق يجب أن يتكون من 6 أرقام',
    'any.required': 'رمز التحقق مطلوب',
  }),
});

