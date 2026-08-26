import Joi from 'joi';

const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;

// 1. Create Group Schema
export const createGroupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'اسم المجموعة مطلوب',
    'any.required': 'اسم المجموعة مطلوب',
  }),
  subjectId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المادة الدراسية غير صالح',
    'any.required': 'المادة الدراسية مطلوبة',
  }),
  stageId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المرحلة الدراسية غير صالح',
    'any.required': 'المرحلة الدراسية مطلوبة',
  }),
  gradeLevelId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف الصف الدراسي غير صالح',
    'any.required': 'الصف الدراسي مطلوب',
  }),
  groupCode: Joi.string().trim().max(50).optional(),
  scheduleDays: Joi.alternatives().try(
    Joi.string().trim().required(),
    Joi.array().items(Joi.string().trim()).min(1).required()
  ).messages({
    'any.required': 'مواعيد أيام الحصص مطلوبة',
  }),
  scheduleTime: Joi.string().trim().max(50).optional().default('05:00 PM'),
  maxCapacity: Joi.number().integer().min(1).max(500).default(50),
  defaultPrice: Joi.number().min(0).default(0),
  description: Joi.string().allow('', null).optional(),
});

// 2. Update Group Schema
export const updateGroupSchema = Joi.object({
  name: Joi.string().trim().min(2).max(191).optional(),
  subjectId: Joi.string().uuid().optional(),
  stageId: Joi.string().uuid().optional(),
  gradeLevelId: Joi.string().uuid().optional(),
  groupCode: Joi.string().trim().max(50).optional(),
  scheduleDays: Joi.alternatives().try(
    Joi.string().trim(),
    Joi.array().items(Joi.string().trim())
  ).optional(),
  scheduleTime: Joi.string().trim().max(50).optional(),
  maxCapacity: Joi.number().integer().min(1).max(500).optional(),
  defaultPrice: Joi.number().min(0).optional(),
  description: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().optional(),
});

// 3. Add / Enroll Student Schema (Find-or-Create)
export const addStudentToGroupSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'اسم الطالب مطلوب',
    'string.min': 'يجب ألا يقل اسم الطالب عن 3 أحرف',
    'any.required': 'اسم الطالب مطلوب',
  }),
  phone: Joi.string().trim().pattern(egyptianPhoneRegex).required().messages({
    'string.pattern.base': 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01020324779)',
    'any.required': 'رقم هاتف الطالب مطلوب',
  }),
  email: Joi.string().email().allow('', null).optional().messages({
    'string.email': 'يرجى إدخال بريد إلكتروني صحيح',
  }),
  parentPhone: Joi.string().trim().pattern(egyptianPhoneRegex).allow('', null).optional().messages({
    'string.pattern.base': 'يرجى إدخال رقم هاتف ولي أمر مصري صحيح',
  }),
  enrollmentPrice: Joi.number().min(0).optional(),
  stageId: Joi.string().uuid().optional(),
  gradeLevelId: Joi.string().uuid().optional(),
});

// 4. Update Student Details in Group Schema
export const updateStudentSchema = Joi.object({
  notes: Joi.string().allow('', null).optional(),
  enrollmentPrice: Joi.number().min(0).optional(),
  targetGroupId: Joi.string().uuid().optional(),
  status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'LEFT').optional(),
});

// 5. Update Teacher Profile Schema
export const updateTeacherProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(100).optional(),
  phone: Joi.string().trim().pattern(egyptianPhoneRegex).optional().messages({
    'string.pattern.base': 'يرجى إدخال رقم هاتف مصري صحيح',
  }),
});

// 6. Update Teacher Settings Schema
export const updateTeacherSettingsSchema = Joi.object({
  appLanguage: Joi.string().valid('ar', 'en', 'fr').optional(),
  darkMode: Joi.boolean().optional(),
  notifyExams: Joi.boolean().optional(),
  notifySubjects: Joi.boolean().optional(),
  notifyHomework: Joi.boolean().optional(),
  notifyAnnouncements: Joi.boolean().optional(),
});

// 7. Create Class Session Schema
export const createSessionSchema = Joi.object({
  groupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة غير صالح',
    'any.required': 'المجموعة مطلوبة',
  }),
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان الجلسة مطلوب',
    'any.required': 'عنوان الجلسة مطلوب',
  }),
  sessionDate: Joi.date().iso().optional().default(() => new Date()),
});

// 8. Manual Attendance Batch Schema
export const manualAttendanceSchema = Joi.object({
  attendances: Joi.array().items(
    Joi.object({
      studentId: Joi.string().uuid().required().messages({
        'string.guid': 'معرف الطالب غير صالح',
        'any.required': 'معرف الطالب مطلوب',
      }),
      status: Joi.string().valid('PRESENT', 'LATE', 'ABSENT').required().messages({
        'any.only': 'حالة الحضور يجب أن تكون PRESENT أو LATE أو ABSENT',
        'any.required': 'حالة الحضور مطلوبة',
      }),
    })
  ).min(1).required().messages({
    'array.min': 'يجب إرسال سجل حضور واحد على الأقل',
    'any.required': 'سجلات الحضور مطلوبة',
  }),
});

// 9. Student Record Attendance Schema (QR or 6-digit Code)
export const recordAttendanceSchema = Joi.object({
  qrToken: Joi.string().trim().optional(),
  sessionCode: Joi.string().trim().optional(),
}).or('qrToken', 'sessionCode').messages({
  'object.missing': 'يجب توفير رمز QR أو كود الجلسة لتسجيل الحضور',
});

// 10. Create Private Subject Schema
export const createSubjectSchema = Joi.object({
  nameAr: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'اسم المادة باللغة العربية مطلوب',
    'any.required': 'اسم المادة باللغة العربية مطلوب',
  }),
  nameEn: Joi.string().trim().min(2).max(100).optional().default('Custom Subject'),
  iconUrl: Joi.string().uri().allow('', null).optional(),
});

// 11. Create Unit Schema
export const createUnitSchema = Joi.object({
  subjectId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المادة الدراسية غير صالح',
    'any.required': 'المادة الدراسية مطلوبة',
  }),
  gradeLevelId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف الصف الدراسي غير صالح',
    'any.required': 'الصف الدراسي مطلوب',
  }),
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان الوحدة مطلوب',
    'any.required': 'عنوان الوحدة مطلوب',
  }),
  order: Joi.number().integer().min(1).default(1),
});

// 12. Update Unit Schema
export const updateUnitSchema = Joi.object({
  title: Joi.string().trim().min(2).max(191).optional(),
  order: Joi.number().integer().min(1).optional(),
});

// 13. Create Lesson Schema
export const createLessonSchema = Joi.object({
  unitId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف الوحدة الدراسية غير صالح',
    'any.required': 'الوحدة الدراسية مطلوبة',
  }),
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان الدرس مطلوب',
    'any.required': 'عنوان الدرس مطلوب',
  }),
  description: Joi.string().allow('', null).optional(),
  order: Joi.number().integer().min(1).default(1),
});

// 14. Update Lesson Schema
export const updateLessonSchema = Joi.object({
  title: Joi.string().trim().min(2).max(191).optional(),
  description: Joi.string().allow('', null).optional(),
  order: Joi.number().integer().min(1).optional(),
});

// 15. Upload Lesson Video Schema
export const uploadVideoSchema = Joi.object({
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان الفيديو مطلوب',
    'any.required': 'عنوان الفيديو مطلوب',
  }),
  description: Joi.string().allow('', null).optional(),
  durationSeconds: Joi.number().integer().min(0).default(0),
  groupId: Joi.string().uuid().allow('', null).optional(),
});

// 16. Upload Lesson Material Schema
export const uploadMaterialSchema = Joi.object({
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان المستند مطلوب',
    'any.required': 'عنوان المستند مطلوب',
  }),
  fileType: Joi.string().valid('PDF', 'DOC', 'DOCX').default('PDF'),
  groupId: Joi.string().uuid().allow('', null).optional(),
});

