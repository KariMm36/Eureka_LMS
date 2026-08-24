import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestSetupHelper } from './testSetup.js';
import prisma from '../../src/config/prisma.js';

describe('TestSetupHelper Verification', () => {
  const helper = new TestSetupHelper('helper_verify');

  beforeAll(async () => {
    await helper.cleanup();
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  it('should create complete academic hierarchy', async () => {
    const academic = await helper.createAcademicHierarchy();
    expect(academic.stage.id).toBeDefined();
    expect(academic.gradeLevel.id).toBeDefined();
    expect(academic.subject.id).toBeDefined();
    expect(academic.unit.id).toBeDefined();
    expect(academic.lesson.id).toBeDefined();
  });

  it('should create a student user with tokens and profile', async () => {
    const student = await helper.createUser({ role: 'STUDENT' });
    expect(student.user.id).toBeDefined();
    expect(student.user.role).toBe('STUDENT');
    expect(student.user.studentProfile).toBeDefined();
    expect(student.token).toBeDefined();
    expect(student.refreshToken).toBeDefined();
  });

  it('should create a group with a teacher', async () => {
    const group = await helper.createGroup();
    expect(group.id).toBeDefined();
    expect(group.groupCode).toBeDefined();
    expect(group.teacherId).toBeDefined();
  });

  it('should create homework with questions and exams with time windows', async () => {
    const group = await helper.createGroup();
    const homework = await helper.createHomework({ groupId: group.id });
    expect(homework.id).toBeDefined();
    expect(homework.questions.length).toBe(2);

    const activeExam = await helper.createExam({ groupId: group.id, windowType: 'ACTIVE' });
    expect(activeExam.id).toBeDefined();
    expect(new Date(activeExam.startTime).getTime()).toBeLessThan(Date.now());
    expect(new Date(activeExam.endTime).getTime()).toBeGreaterThan(Date.now());

    const futureExam = await helper.createExam({ groupId: group.id, windowType: 'FUTURE' });
    expect(new Date(futureExam.startTime).getTime()).toBeGreaterThan(Date.now());

    const pastExam = await helper.createExam({ groupId: group.id, windowType: 'PAST' });
    expect(new Date(pastExam.endTime).getTime()).toBeLessThan(Date.now());
  });

  it('should create a group with multiple ranked students for analytics', async () => {
    const group = await helper.createGroup();
    const homework = await helper.createHomework({ groupId: group.id });
    const rankedStudents = await helper.createGroupWithRankedStudents(group.id, homework.id);

    expect(rankedStudents.length).toBe(4);
    expect(rankedStudents[0].expectedScore).toBe(95);
    expect(rankedStudents[3].expectedScore).toBe(30);
  });
});
