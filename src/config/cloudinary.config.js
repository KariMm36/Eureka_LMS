import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { logger } from './logger.config.js';
import { ApiError } from '../utils/apiError.js';

// Determine if Cloudinary is configured with valid credentials
export const isCloudinaryEnabled = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Initialize Cloudinary if credentials exist
if (isCloudinaryEnabled()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  logger.info('[Cloudinary] Cloudinary storage initialized successfully');
} else {
  logger.info('[Cloudinary] Cloudinary credentials not configured — operating in Local Disk Storage mode (/uploads)');
}

export const CLOUDINARY_FOLDERS = {
  STUDENT_AVATARS: 'eureka/avatars/students',
  TEACHER_AVATARS: 'eureka/avatars/teachers',
  GROUP_COVERS: 'eureka/groups/covers',
  SUBJECT_ICONS: 'eureka/subjects/icons',
  LESSON_VIDEOS: 'eureka/lessons/videos',
  LESSON_MATERIALS: 'eureka/lessons/materials',
  PAYMENT_RECEIPTS: 'eureka/payments/receipts',
};

/**
 * Upload a Multer file to Cloudinary with local fallback when Cloudinary is disabled
 * @param {Object} params
 * @param {Express.Multer.File} params.file - Multer file object
 * @param {string} params.folder - Target Cloudinary folder
 * @param {'image'|'video'|'raw'|'auto'} [params.resourceType='auto'] - Cloudinary resource type
 * @returns {Promise<string>} Secure URL or local `/uploads/${filename}`
 */
export const handleFileUpload = async ({ file, folder, resourceType = 'auto' }) => {
  if (!file) return null;

  // Local storage mode fallback when Cloudinary is not configured
  if (!isCloudinaryEnabled()) {
    return `/uploads/${file.filename}`;
  }

  // Cloudinary upload mode
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: resourceType,
      use_filename: false,
      unique_filename: true,
    });

    // Cleanup local temporary file after successful Cloudinary upload
    if (fs.existsSync(file.path)) {
      await fs.promises.unlink(file.path).catch((err) => {
        logger.warn({ err: err.message, path: file.path }, '[Cloudinary Cleanup] Failed to delete temp file');
      });
    }

    return result.secure_url;
  } catch (error) {
    // Cleanup local temp file on upload error
    if (fs.existsSync(file.path)) {
      await fs.promises.unlink(file.path).catch(() => {});
    }

    logger.error(
      { err: error.message, folder, resourceType },
      '[Cloudinary Error] Failed to upload file to Cloudinary'
    );

    throw ApiError.badRequest('فشل رفع الملف إلى السحابة. يرجى المحاولة مرة أخرى لاحقاً');
  }
};

export default {
  isCloudinaryEnabled,
  CLOUDINARY_FOLDERS,
  handleFileUpload,
  cloudinary,
};
