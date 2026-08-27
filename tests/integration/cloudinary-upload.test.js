import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { v2 as cloudinary } from 'cloudinary';
import { handleFileUpload, isCloudinaryEnabled, CLOUDINARY_FOLDERS } from '../../src/config/cloudinary.config.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Cloudinary Media Storage & Local Fallback Architecture Suite', () => {
  const helper = new TestSetupHelper('cloudinary_suite');
  let studentUser;
  let teacherUser;
  let stage;
  let gradeLevel;
  let subject;
  let unit;
  let lesson;
  let group;

  const tempTestDir = path.join(process.cwd(), 'uploads');
  let savedEnv = {};

  beforeAll(async () => {
    await helper.cleanup();

    // 1. Create Academic Hierarchy
    const academic = await helper.createAcademicHierarchy();
    stage = academic.stage;
    gradeLevel = academic.gradeLevel;
    subject = academic.subject;

    // 2. Create Users
    teacherUser = await helper.createUser({ role: 'TEACHER' });
    studentUser = await helper.createUser({ role: 'STUDENT' });

    // 3. Create Unit and Lesson owned by teacherUser
    unit = await prisma.unit.create({
      data: {
        title: 'وحدة الفيزياء التجريبية',
        order: 1,
        subjectId: subject.id,
        gradeLevelId: gradeLevel.id,
        createdById: teacherUser.user.id,
      },
    });
    helper.createdUnitIds.add(unit.id);

    lesson = await prisma.lesson.create({
      data: {
        unitId: unit.id,
        title: 'درس الحركة والقوة',
        order: 1,
        createdById: teacherUser.user.id,
      },
    });
    helper.createdLessonIds.add(lesson.id);

    // 4. Create Group & Enroll Student
    group = await helper.createGroup({ teacherId: teacherUser.user.id });
    await helper.enrollStudent(studentUser.user.studentProfile.id, group.id, 'ACTIVE');
  });

  beforeEach(() => {
    savedEnv = {
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    };
    // Default to local mode for deterministic local tests
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  afterEach(() => {
    if (savedEnv.CLOUDINARY_CLOUD_NAME !== undefined) process.env.CLOUDINARY_CLOUD_NAME = savedEnv.CLOUDINARY_CLOUD_NAME;
    if (savedEnv.CLOUDINARY_API_KEY !== undefined) process.env.CLOUDINARY_API_KEY = savedEnv.CLOUDINARY_API_KEY;
    if (savedEnv.CLOUDINARY_API_SECRET !== undefined) process.env.CLOUDINARY_API_SECRET = savedEnv.CLOUDINARY_API_SECRET;
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Environment & Mode Detection
  // =========================================================================
  describe('1. Configuration & Mode Detection', () => {
    it('1.1 should correctly identify when Cloudinary credentials are not set', () => {
      expect(isCloudinaryEnabled()).toBe(false);
    });

    it('1.2 should return local path fallback when Cloudinary is disabled', async () => {
      const mockFile = {
        filename: 'test-local-img.png',
        path: path.join(tempTestDir, 'test-local-img.png'),
      };

      const resultUrl = await handleFileUpload({
        file: mockFile,
        folder: CLOUDINARY_FOLDERS.STUDENT_AVATARS,
        resourceType: 'image',
      });

      expect(resultUrl).toBe('/uploads/test-local-img.png');
    });
  });

  // =========================================================================
  // 2. Local File Upload Endpoints (MIME & Functionality)
  // =========================================================================
  describe('2. Local File Upload Functionality & Validation', () => {
    it('2.1 should upload student avatar in local mode', async () => {
      const dummyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

      const res = await request(app)
        .put('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentUser.token}`)
        .attach('avatar', dummyPng, 'my-avatar.png')
        .field('fullName', 'Student Updated');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.avatarUrl).toMatch(/^\/uploads\/avatar-/);
    });

    it('2.2 should reject invalid image MIME type (e.g. .txt uploaded as avatar)', async () => {
      const fakeTextFile = Buffer.from('This is a text file not an image');

      const res = await request(app)
        .put('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentUser.token}`)
        .attach('avatar', fakeTextFile, 'hacker.txt');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('صيغة الصورة غير مدعومة');
    });

    it('2.3 should upload teacher avatar in local mode', async () => {
      const dummyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

      const res = await request(app)
        .put('/api/v1/teacher/profile')
        .set('Authorization', `Bearer ${teacherUser.token}`)
        .attach('avatar', dummyPng, 'teacher-avatar.png')
        .field('fullName', 'Teacher Updated');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.avatarUrl).toMatch(/^\/uploads\/avatar-/);
    });

    it('2.4 should upload group cover image in local mode', async () => {
      const dummyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

      const res = await request(app)
        .post('/api/v1/teacher/groups')
        .set('Authorization', `Bearer ${teacherUser.token}`)
        .attach('cover', dummyPng, 'group-cover.png')
        .field('name', 'Cloudinary Test Group')
        .field('subjectId', subject.id)
        .field('stageId', stage.id)
        .field('gradeLevelId', gradeLevel.id)
        .field('scheduleDays', JSON.stringify(['SUNDAY', 'TUESDAY']))
        .field('scheduleTime', '04:00 PM')
        .field('maxCapacity', 40)
        .field('defaultPrice', 300);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.coverImageUrl).toMatch(/^\/uploads\/cover-/);
      helper.createdGroupIds.add(res.body.data.id);
    });

    it('2.5 should upload lesson video in local mode', async () => {
      const dummyVideo = Buffer.from('00000018667479706d703432000000006d7034326d703431', 'hex');

      const res = await request(app)
        .post(`/api/v1/teacher/lessons/${lesson.id}/videos`)
        .set('Authorization', `Bearer ${teacherUser.token}`)
        .attach('video', dummyVideo, 'lesson-intro.mp4')
        .field('title', 'شرح الدرس الأول')
        .field('durationSeconds', 120);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.videoUrl).toMatch(/^\/uploads\/video-/);
    });

    it('2.6 should upload lesson material document in local mode', async () => {
      const dummyPdf = Buffer.from('%PDF-1.4 1 0 obj << /Type /Catalog >> endobj trailer << /Root 1 0 R >> %%EOF');

      const res = await request(app)
        .post(`/api/v1/teacher/lessons/${lesson.id}/materials`)
        .set('Authorization', `Bearer ${teacherUser.token}`)
        .attach('document', dummyPdf, 'worksheet.pdf')
        .field('title', 'ملزمة الوحدة الأولى')
        .field('fileType', 'PDF');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fileUrl).toMatch(/^\/uploads\/document-/);
    });

    it('2.7 should upload payment receipt in local mode via multipart/form-data', async () => {
      const dummyReceipt = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

      const res = await request(app)
        .post('/api/v1/teacher/finance/payments')
        .set('Authorization', `Bearer ${teacherUser.token}`)
        .attach('receipt', dummyReceipt, 'vodafone-receipt.png')
        .field('studentId', studentUser.user.studentProfile.id)
        .field('groupId', group.id)
        .field('amount', 350)
        .field('paymentMethod', 'VODAFONE_CASH')
        .field('monthLabel', '2026-08');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptUrl).toMatch(/^\/uploads\/receipt-/);
    });

    it('2.8 should support backward compatibility when receiptUrl is provided in JSON body', async () => {
      const res = await request(app)
        .post('/api/v1/teacher/finance/payments')
        .set('Authorization', `Bearer ${teacherUser.token}`)
        .send({
          studentId: studentUser.user.studentProfile.id,
          groupId: group.id,
          amount: 400,
          paymentMethod: 'INSTAPAY',
          monthLabel: '2026-09',
          receiptUrl: 'https://storage.provider.com/receipt-123.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptUrl).toBe('https://storage.provider.com/receipt-123.jpg');
    });
  });

  // =========================================================================
  // 3. Mocked Cloudinary Upload Execution
  // =========================================================================
  describe('3. Cloudinary Upload Pipeline (Mocked SDK)', () => {
    it('3.1 should upload file to Cloudinary, return secure URL, and clean up temp local file', async () => {
      // Mock Cloudinary credentials in env
      process.env.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
      process.env.CLOUDINARY_API_KEY = 'mock-key';
      process.env.CLOUDINARY_API_SECRET = 'mock-secret';

      // Create a temporary test file on disk
      const tempFilePath = path.join(tempTestDir, 'temp-cloudinary-test.png');
      fs.writeFileSync(tempFilePath, 'dummy-image-content');
      expect(fs.existsSync(tempFilePath)).toBe(true);

      // Mock cloudinary.uploader.upload
      const spyUpload = vi.spyOn(cloudinary.uploader, 'upload').mockResolvedValueOnce({
        secure_url: 'https://res.cloudinary.com/mock-cloud/image/upload/v12345/eureka/avatars/students/sample.jpg',
        public_id: 'eureka/avatars/students/sample',
      });

      const mockFile = {
        filename: 'temp-cloudinary-test.png',
        path: tempFilePath,
      };

      const resultUrl = await handleFileUpload({
        file: mockFile,
        folder: CLOUDINARY_FOLDERS.STUDENT_AVATARS,
        resourceType: 'image',
      });

      expect(spyUpload).toHaveBeenCalledTimes(1);
      expect(resultUrl).toBe('https://res.cloudinary.com/mock-cloud/image/upload/v12345/eureka/avatars/students/sample.jpg');
      // Temporary file should have been deleted
      expect(fs.existsSync(tempFilePath)).toBe(false);

      spyUpload.mockRestore();
    });

    it('3.2 should handle Cloudinary upload failure cleanly and delete temp file', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
      process.env.CLOUDINARY_API_KEY = 'mock-key';
      process.env.CLOUDINARY_API_SECRET = 'mock-secret';

      const tempFilePath = path.join(tempTestDir, 'temp-cloudinary-fail.png');
      fs.writeFileSync(tempFilePath, 'dummy-image-content');

      const spyUpload = vi.spyOn(cloudinary.uploader, 'upload').mockRejectedValueOnce(
        new Error('Cloudinary Connection Timeout')
      );

      const mockFile = {
        filename: 'temp-cloudinary-fail.png',
        path: tempFilePath,
      };

      await expect(
        handleFileUpload({
          file: mockFile,
          folder: CLOUDINARY_FOLDERS.GROUP_COVERS,
          resourceType: 'image',
        })
      ).rejects.toThrow('فشل رفع الملف إلى السحابة');

      // Temp file should still be cleaned up on error
      expect(fs.existsSync(tempFilePath)).toBe(false);

      spyUpload.mockRestore();
    });
  });
});
