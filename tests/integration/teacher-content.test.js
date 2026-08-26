import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Teacher Curriculum Content CRUD Integration Suite', () => {
  let helper;
  let teacherA;
  let teacherB;
  let hierarchy;
  let createdSubjectId;
  let createdUnitId;
  let createdLessonId;
  let createdVideoId;
  let createdMaterialId;

  beforeAll(async () => {
    helper = new TestSetupHelper('teacher_content');
    hierarchy = await helper.createAcademicHierarchy();

    teacherA = await helper.createTeacher({ fullName: 'معلم المحتوى أ' });
    teacherB = await helper.createTeacher({ fullName: 'معلم المحتوى ب' });
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  it('1. should create a private teacher subject', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/subjects')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .field('nameAr', 'الكيمياء العضوية المتقدمة')
      .field('nameEn', 'Advanced Organic Chemistry');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.isGlobal).toBe(false);

    createdSubjectId = res.body.data.id;
  });

  it('2. should list teacher subjects', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/subjects')
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const subj = res.body.data.find((s) => s.id === createdSubjectId);
    expect(subj).toBeDefined();
  });

  it('3. should create a curriculum unit under subject and grade level', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/units')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        subjectId: createdSubjectId,
        gradeLevelId: hierarchy.gradeLevel.id,
        title: 'الوحدة الأولى: المركبات الهيدروكربونية',
        order: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();

    createdUnitId = res.body.data.id;
  });

  it('4. should update curriculum unit title and order', async () => {
    const res = await request(app)
      .put(`/api/v1/teacher/units/${createdUnitId}`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        title: 'الوحدة الأولى: الهيدروكربونات والألكانات',
        order: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toContain('الهيدروكربونات');
  });

  it('5. should create a lesson under unit', async () => {
    const res = await request(app)
      .post('/api/v1/teacher/lessons')
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        unitId: createdUnitId,
        title: 'الدرس الأول: الميثان والإيثان',
        description: 'شرح الصيغ البنائية والجزيئية',
        order: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();

    createdLessonId = res.body.data.id;
  });

  it('6. should update lesson title and description', async () => {
    const res = await request(app)
      .put(`/api/v1/teacher/lessons/${createdLessonId}`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .send({
        title: 'الدرس الأول: الألكانات والتسمية النظامية (IUPAC)',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toContain('IUPAC');
  });

  it('7. should upload a lesson video', async () => {
    const res = await request(app)
      .post(`/api/v1/teacher/lessons/${createdLessonId}/videos`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .field('title', 'فيديو شرح تسمية الألكانات')
      .field('durationSeconds', 1500)
      .attach('video', Buffer.from('mock video data'), {
        filename: 'lesson_video.mp4',
        contentType: 'video/mp4',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.videoUrl).toBeDefined();

    createdVideoId = res.body.data.id;
  });

  it('8. should upload a study PDF document material', async () => {
    const res = await request(app)
      .post(`/api/v1/teacher/lessons/${createdLessonId}/materials`)
      .set('Authorization', `Bearer ${teacherA.token}`)
      .field('title', 'ملخص قوانين الألكانات PDF')
      .field('fileType', 'PDF')
      .attach('document', Buffer.from('%PDF-1.4 mock pdf data'), {
        filename: 'alkanes_summary.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.fileUrl).toBeDefined();

    createdMaterialId = res.body.data.id;
  });

  it('9. [IDOR Prevention] Teacher B cannot modify or delete Teacher A content', async () => {
    // Attempt updating unit
    const unitRes = await request(app)
      .put(`/api/v1/teacher/units/${createdUnitId}`)
      .set('Authorization', `Bearer ${teacherB.token}`)
      .send({ title: 'تعديل غير مصرح' });

    expect(unitRes.status).toBe(404);

    // Attempt updating lesson
    const lessonRes = await request(app)
      .put(`/api/v1/teacher/lessons/${createdLessonId}`)
      .set('Authorization', `Bearer ${teacherB.token}`)
      .send({ title: 'تعديل غير مصرح' });

    expect(lessonRes.status).toBe(404);
  });

  it('10. should delete media attachments (video and material)', async () => {
    // 1. Delete video
    const delVidRes = await request(app)
      .delete(`/api/v1/teacher/lessons/${createdLessonId}/media/video/${createdVideoId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(delVidRes.status).toBe(200);
    expect(delVidRes.body.success).toBe(true);

    // 2. Delete material
    const delMatRes = await request(app)
      .delete(`/api/v1/teacher/lessons/${createdLessonId}/media/material/${createdMaterialId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(delMatRes.status).toBe(200);
    expect(delMatRes.body.success).toBe(true);
  });

  it('11. should delete lesson and unit', async () => {
    // 1. Delete Lesson
    const delLessonRes = await request(app)
      .delete(`/api/v1/teacher/lessons/${createdLessonId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(delLessonRes.status).toBe(200);

    // 2. Delete Unit
    const delUnitRes = await request(app)
      .delete(`/api/v1/teacher/units/${createdUnitId}`)
      .set('Authorization', `Bearer ${teacherA.token}`);

    expect(delUnitRes.status).toBe(200);
  });
});
