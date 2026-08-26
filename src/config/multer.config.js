import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

const createUploader = ({ maxSize, allowedMimeTypes, customErrorMessage }) => {
  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(customErrorMessage || 'نوع الملف المرفوع غير مدعوم'), false);
      }
    },
  });
};

// General upload uploader (5MB, backward-compatible)
export const upload = createUploader({
  maxSize: 5 * 1024 * 1024,
  allowedMimeTypes: [...IMAGE_MIMES, ...DOC_MIMES],
  customErrorMessage: 'نوع الملف غير مدعوم (الملفات المدعومة: صور JPG, PNG, WEBP ومستندات PDF)',
});

// 1. Group Cover & Student Avatar Uploader (Max 2MB)
export const uploadImage = createUploader({
  maxSize: 2 * 1024 * 1024,
  allowedMimeTypes: IMAGE_MIMES,
  customErrorMessage: 'صيغة الصورة غير مدعومة (يجب أن تكون JPG أو PNG أو WEBP بحد أقصى 2 ميجابايت)',
});

// 2. Study PDF & Material Uploader (Max 10MB)
export const uploadDocument = createUploader({
  maxSize: 10 * 1024 * 1024,
  allowedMimeTypes: DOC_MIMES,
  customErrorMessage: 'نوع المستند غير مدعوم (الملفات المدعومة: PDF ومستندات Word بحد أقصى 10 ميجابايت)',
});

// 3. Lesson Video Uploader (Max 500MB)
export const uploadVideo = createUploader({
  maxSize: 500 * 1024 * 1024,
  allowedMimeTypes: VIDEO_MIMES,
  customErrorMessage: 'صيغة الفيديو غير مدعومة (الفيديوهات المدعومة: MP4, MOV, WEBM بحد أقصى 500 ميجابايت)',
});

// 4. Payment Receipt Uploader (Max 2MB)
export const uploadReceipt = createUploader({
  maxSize: 2 * 1024 * 1024,
  allowedMimeTypes: [...IMAGE_MIMES, 'application/pdf'],
  customErrorMessage: 'نوع الإيصال غير مدعوم (الصور المسموحة: JPG, PNG, WEBP أو ملف PDF بحد أقصى 2 ميجابايت)',
});

