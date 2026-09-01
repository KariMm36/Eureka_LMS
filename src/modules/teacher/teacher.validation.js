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
  scheduleTime: Joi.string().trim().max(50).allow(null, '').optional(),
  maxCapacity: Joi.number().integer().min(1).max(500).default(50),
  defaultPrice: Joi.number().min(0).max(100000).default(0),
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
  defaultPrice: Joi.number().min(0).max(100000).optional(),
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
  enrollmentPrice: Joi.number().min(0).max(100000).optional(),
  stageId: Joi.string().uuid().optional(),
  gradeLevelId: Joi.string().uuid().optional(),
});

// 4. Update Student Details in Group Schema
export const updateStudentSchema = Joi.object({
  notes: Joi.string().allow('', null).optional(),
  enrollmentPrice: Joi.number().min(0).max(100000).optional(),
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

// ----------------------------------------------------
// Milestone 3: Assessment Authoring Wizards & Grading Schemas
// ----------------------------------------------------

const questionItemSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  type: Joi.string().valid('MCQ', 'ESSAY').default('MCQ'),
  questionText: Joi.string().trim().required().messages({
    'string.empty': 'نص السؤال مطلوب',
    'any.required': 'نص السؤال مطلوب',
  }),
  options: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  correctOptionIndex: Joi.number().integer().min(0).allow(null).optional(),
  explanation: Joi.string().allow('', null).optional(),
  modelAnswer: Joi.string().allow('', null).optional(),
  minWords: Joi.number().integer().min(0).default(0),
  score: Joi.number().integer().min(1).default(1),
  order: Joi.number().integer().min(1).optional(),
});

// 17. Create Homework Schema (Screen: "Add Homework")
export const createHomeworkSchema = Joi.object({
  groupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة غير صالح',
    'any.required': 'المجموعة مطلوبة',
  }),
  lessonId: Joi.string().uuid().allow('', null).optional(),
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان الواجب مطلوب',
    'any.required': 'عنوان الواجب مطلوب',
  }),
  unitName: Joi.string().trim().allow('', null).optional(),
  durationMinutes: Joi.number().integer().min(1).default(30),
  dueDate: Joi.date().iso().required().messages({
    'any.required': 'موعد تسليم الواجب مطلوب',
  }),
  questions: Joi.array().items(questionItemSchema).min(1).required().messages({
    'array.min': 'يجب إضافة سؤال واحد على الأقل للواجب',
    'any.required': 'قائمة الأسئلة مطلوبة',
  }),
});

// 18. Update Homework Schema
export const updateHomeworkSchema = Joi.object({
  title: Joi.string().trim().min(2).max(191).optional(),
  unitName: Joi.string().trim().allow('', null).optional(),
  durationMinutes: Joi.number().integer().min(1).optional(),
  dueDate: Joi.date().iso().optional(),
  questions: Joi.array().items(questionItemSchema).optional(),
});

// 19. Create Exam Schema (Screen: "Add Exam")
export const createExamSchema = Joi.object({
  groupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة غير صالح',
    'any.required': 'المجموعة مطلوبة',
  }),
  lessonId: Joi.string().uuid().allow('', null).optional(),
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان الامتحان مطلوب',
    'any.required': 'عنوان الامتحان مطلوب',
  }),
  durationMinutes: Joi.number().integer().min(1).required().messages({
    'any.required': 'مدة الامتحان بالدقائق مطلوبة',
  }),
  passingScorePercentage: Joi.number().integer().min(1).max(100).default(60),
  guidelinesJson: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  startTime: Joi.date().iso().required().messages({
    'any.required': 'تاريخ ووقت بدء الامتحان مطلوب',
  }),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required().messages({
    'date.greater': 'تاريخ انتهاء الامتحان يجب أن يكون بعد تاريخ البدء',
    'any.required': 'تاريخ ووقت انتهاء الامتحان مطلوب',
  }),
  questions: Joi.array().items(questionItemSchema).min(1).required().messages({
    'array.min': 'يجب إضافة سؤال واحد على الأقل للامتحان',
    'any.required': 'قائمة الأسئلة مطلوبة',
  }),
});

// 20. Update Exam Schema
export const updateExamSchema = Joi.object({
  title: Joi.string().trim().min(2).max(191).optional(),
  durationMinutes: Joi.number().integer().min(1).optional(),
  passingScorePercentage: Joi.number().integer().min(1).max(100).optional(),
  guidelinesJson: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().optional(),
  questions: Joi.array().items(questionItemSchema).optional(),
});

// 21. Grade Essay Question Schema (Screen: "Grading")
export const gradeEssaySchema = Joi.object({
  submissionType: Joi.string().valid('HOMEWORK', 'EXAM').default('EXAM'),
  submissionId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف التسليم غير صالح',
    'any.required': 'معرف التسليم مطلوب',
  }),
  questionId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف السؤال غير صالح',
    'any.required': 'معرف السؤال مطلوب',
  }),
  scoreAwarded: Joi.number().min(0).required().messages({
    'any.required': 'الدرجة المستحقة مطلوبة',
  }),
  feedback: Joi.string().allow('', null).optional(),
});

// ----------------------------------------------------
// Milestone 4: Finance Ledger & Broadcast Announcements
// ----------------------------------------------------

// 22. Record Student Payment Schema
export const recordPaymentSchema = Joi.object({
  studentId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف الطالب غير صالح',
    'any.required': 'معرف الطالب مطلوب',
  }),
  groupId: Joi.string().uuid().required().messages({
    'string.guid': 'معرف المجموعة غير صالح',
    'any.required': 'معرف المجموعة مطلوب',
  }),
  amount: Joi.number().min(0).max(1000000).required().messages({
    'number.base': 'المبلغ المدفوع يجب أن يكون رقماً',
    'any.required': 'المبلغ المدفوع مطلوب',
  }),
  paymentMethod: Joi.string().valid('CASH', 'VODAFONE_CASH', 'INSTAPAY', 'CARD', 'OTHER').default('CASH'),
  monthLabel: Joi.string().trim().max(50).optional(),
  receiptUrl: Joi.string().uri().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
});

// 23. Broadcast Announcement Schema
export const broadcastNotificationSchema = Joi.object({
  targetType: Joi.string().valid('GROUP', 'STAGE', 'GRADE_LEVEL', 'ALL_MY_STUDENTS').default('GROUP'),
  groupId: Joi.string().uuid().when('targetType', {
    is: 'GROUP',
    then: Joi.required().messages({ 'any.required': 'معرف المجموعة مطلوب عند اختيار إرسال لمجموعة' }),
    otherwise: Joi.optional().allow('', null),
  }),
  stageId: Joi.string().uuid().when('targetType', {
    is: 'STAGE',
    then: Joi.required().messages({ 'any.required': 'معرف المرحلة مطلوب عند اختيار إرسال لمرحلة' }),
    otherwise: Joi.optional().allow('', null),
  }),
  gradeLevelId: Joi.string().uuid().when('targetType', {
    is: 'GRADE_LEVEL',
    then: Joi.required().messages({ 'any.required': 'معرف الصف مطلوب عند اختيار إرسال لصف دراسي' }),
    otherwise: Joi.optional().allow('', null),
  }),
  title: Joi.string().trim().min(2).max(191).required().messages({
    'string.empty': 'عنوان الإشعار مطلوب',
    'any.required': 'عنوان الإشعار مطلوب',
  }),
  body: Joi.string().trim().min(2).required().messages({
    'string.empty': 'محتوى الإشعار مطلوب',
    'any.required': 'محتوى الإشعار مطلوب',
  }),
  attachments: Joi.array().items(Joi.string()).optional(),
});



