import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EGYPTIAN_STAGES } from '../src/constants/stages.constant.js';
import { CORE_SUBJECTS } from '../src/constants/subjects.constant.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for Eureka LMS...');

  // 0. Seed Bootstrap Super-Admin (Environment-configured, idempotent, safe against collisions)
  console.log('👑 Seeding Bootstrap Super-Admin...');
  const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@eureka.com').toLowerCase().trim();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@SecurePass2026!';
  const adminPhone = (process.env.DEFAULT_ADMIN_PHONE || '01000000000').trim();

  // Find user by adminEmail first, or any existing ADMIN account
  let admin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!admin) {
    admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
  }

  if (!admin) {
    // Check if configured phone is taken by a different user
    const phoneConflict = await prisma.user.findUnique({
      where: { phone: adminPhone },
    });
    const safePhone = phoneConflict ? `010${Math.floor(10000000 + Math.random() * 90000000)}` : adminPhone;

    const adminSalt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash(adminPassword, adminSalt);

    await prisma.user.create({
      data: {
        fullName: 'مدير النظام (Admin)',
        email: adminEmail,
        phone: safePhone,
        password: adminHash,
        role: 'ADMIN',
        isVerified: true,
        isActive: true,
      },
    });
    console.log(`✅ Super-Admin created (${adminEmail})`);
  } else {
    // Idempotent update without overwriting password
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'ADMIN', isVerified: true, isActive: true },
    });
    console.log(`ℹ️ Super-Admin verified (${admin.email})`);
  }

  // Seed SystemSettings singleton
  await prisma.systemSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      maintenanceMode: false,
      registrationOpen: true,
      supportEmail: 'support@eureka-lms.com',
      supportPhone: '+201000000000',
    },
  });

  // 1. Seed Stages & Grades
  console.log('📚 Seeding Educational Stages and Grades...');
  for (const stageData of EGYPTIAN_STAGES) {
    const stage = await prisma.stage.upsert({
      where: { key: stageData.key },
      update: {
        nameAr: stageData.nameAr,
        nameEn: stageData.nameEn,
        order: stageData.order,
      },
      create: {
        key: stageData.key,
        nameAr: stageData.nameAr,
        nameEn: stageData.nameEn,
        order: stageData.order,
      },
    });

    for (const grade of stageData.grades) {
      const existingGrade = await prisma.gradeLevel.findFirst({
        where: { stageId: stage.id, gradeNumber: grade.gradeNumber },
      });

      if (!existingGrade) {
        await prisma.gradeLevel.create({
          data: {
            stageId: stage.id,
            nameAr: grade.nameAr,
            nameEn: grade.nameEn,
            gradeNumber: grade.gradeNumber,
          },
        });
      }
    }
  }

  // 2. Seed Core Subjects
  console.log('📖 Seeding Core Subjects...');
  for (const subjectData of CORE_SUBJECTS) {
    const existingSubject = await prisma.subject.findFirst({
      where: { nameAr: subjectData.nameAr },
    });

    if (!existingSubject) {
      await prisma.subject.create({
        data: {
          nameAr: subjectData.nameAr,
          nameEn: subjectData.nameEn,
          iconUrl: subjectData.iconUrl,
        },
      });
    }
  }

  // 3. Seed Teachers
  console.log('👨‍🏫 Seeding Teachers...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Teacher@123456', salt);

  // Helper function to safely upsert teacher without phone/email collisions
  async function upsertTeacher(fullName, email, phone, avatarUrl) {
    let teacher = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (teacher) {
      teacher = await prisma.user.update({
        where: { id: teacher.id },
        data: { fullName, email, phone, avatarUrl, role: 'TEACHER' },
      });
    } else {
      teacher = await prisma.user.create({
        data: {
          fullName,
          email,
          phone,
          password: passwordHash,
          role: 'TEACHER',
          avatarUrl,
        },
      });
    }
    return teacher;
  }

  const teacher1 = await upsertTeacher(
    'أ/ أحمد محمد',
    'teacher.ahmed@eureka.com',
    '01012345678',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  );

  const teacher2 = await upsertTeacher(
    'أ/ محمد علي',
    'teacher.mohamed@eureka.com',
    '01022345679',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
  );

  const teacher3 = await upsertTeacher(
    'أ/ حسام يوسف',
    'teacher.hossam@eureka.com',
    '01033345680',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
  );

  // 4. Fetch References for Primary Stage Grade 6
  const primaryStage = await prisma.stage.findUnique({ where: { key: 'PRIMARY' } });
  const primary6Grade = await prisma.gradeLevel.findFirst({
    where: { stageId: primaryStage?.id, gradeNumber: 6 },
  });

  const physicsSubject = await prisma.subject.findFirst({ where: { nameAr: 'الفيزياء' } });
  const mathSubject = await prisma.subject.findFirst({ where: { nameAr: 'الرياضيات' } });
  const chemistrySubject = await prisma.subject.findFirst({ where: { nameAr: 'الكيمياء' } });
  const biologySubject = await prisma.subject.findFirst({ where: { nameAr: 'الأحياء' } });
  const arabicSubject = await prisma.subject.findFirst({ where: { nameAr: 'اللغة العربية' } });

  // 5. Seed Groups
  console.log('👥 Seeding Multiple Groups with Join Codes...');
  if (primaryStage && primary6Grade) {
    // Group 1: Physics Group A (Code: PHY-10-A)
    if (physicsSubject) {
      const group1 = await prisma.group.upsert({
        where: { groupCode: 'PHY-10-A' },
        update: {},
        create: {
          name: 'الصف السادس - مجموعة أ',
          teacherId: teacher1.id,
          subjectId: physicsSubject.id,
          stageId: primaryStage.id,
          gradeLevelId: primary6Grade.id,
          groupCode: 'PHY-10-A',
          scheduleDays: 'الأحد,الثلاثاء,الخميس',
          scheduleTime: '07:00 PM',
          maxCapacity: 35,
          isActive: true,
        },
      });

      // Add Homework to Group 1
      await prisma.homework.upsert({
        where: { id: 'hw-phys-01' },
        update: {},
        create: {
          id: 'hw-phys-01',
          groupId: group1.id,
          title: 'حل مسائل الفصل الثاني - الحركة والقوة',
          unitName: 'الوحدة الثانية',
          durationMinutes: 45,
          totalScore: 30,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          questions: {
            create: [
              {
                type: 'MCQ',
                questionText: 'ما هي وحدة قياس القوة في النظام الدولي؟',
                options: JSON.stringify(['الجول', 'النيوتن', 'الوات', 'الباسكال']),
                correctOptionIndex: 1,
                score: 10,
                order: 1,
              },
              {
                type: 'MCQ',
                questionText: 'ما هو قانون نيوتن الأول للحركة؟',
                options: JSON.stringify(['قانون القصور الذاتي', 'قانون التسارع', 'قانون الفعل ورد الفعل', 'قانون الجاذبية']),
                correctOptionIndex: 0,
                score: 10,
                order: 2,
              },
              {
                type: 'ESSAY',
                questionText: 'اكتب باختصار عن أهمية قوانين نيوتن وتطبيقاتها في حياتنا اليومية (لا يقل عن 50 كلمة).',
                minWords: 50,
                score: 10,
                order: 3,
              },
            ],
          },
        },
      });

      // Add Upcoming Exam to Group 1
      await prisma.exam.upsert({
        where: { id: 'exam-phys-01' },
        update: {},
        create: {
          id: 'exam-phys-01',
          groupId: group1.id,
          title: 'اختبار الفيزياء الأسبوعي - الفصل الأول والثاني',
          durationMinutes: 60,
          passingScorePercentage: 60,
          guidelinesJson: JSON.stringify([
            'إجمالي الأسئلة 15 سؤال اختيار من متعدد وسؤال مقالي',
            'الحد الزمني 60 دقيقة',
            'تأكد من شحن جهازك والاتصال بالإنترنت',
          ]),
          startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          totalScore: 100,
          questions: {
            create: [
              {
                type: 'MCQ',
                questionText: 'ما هي عاصمة دولة اليابان؟',
                options: JSON.stringify(['كيوتو', 'طوكيو', 'أوساكا', 'هيروشيما']),
                correctOptionIndex: 1,
                explanation: 'طوكيو هي عاصمة اليابان وأكبر مدنها.',
                score: 20,
                order: 1,
              },
              {
                type: 'MCQ',
                questionText: 'ما هو الرمز الكيميائي لعنصر الأكسجين؟',
                options: JSON.stringify(['H', 'O', 'N', 'C']),
                correctOptionIndex: 1,
                explanation: 'O يرمز للأكسجين.',
                score: 20,
                order: 2,
              },
            ],
          },
        },
      });
    }

    // Group 2: Math Group B (Code: MATH-06-A)
    if (mathSubject) {
      await prisma.group.upsert({
        where: { groupCode: 'MATH-06-A' },
        update: {},
        create: {
          name: 'الصف السادس - مجموعة الرياضيات المتفوقين',
          teacherId: teacher2.id,
          subjectId: mathSubject.id,
          stageId: primaryStage.id,
          gradeLevelId: primary6Grade.id,
          groupCode: 'MATH-06-A',
          scheduleDays: 'الأحد,الثلاثاء,الخميس',
          scheduleTime: '06:00 PM',
          maxCapacity: 40,
          isActive: true,
        },
      });
    }

    // Group 3: Chemistry Group (Code: CHEM-06-A)
    if (chemistrySubject) {
      await prisma.group.upsert({
        where: { groupCode: 'CHEM-06-A' },
        update: {},
        create: {
          name: 'الصف السادس - مجموعة الكيمياء العامة',
          teacherId: teacher3.id,
          subjectId: chemistrySubject.id,
          stageId: primaryStage.id,
          gradeLevelId: primary6Grade.id,
          groupCode: 'CHEM-06-A',
          scheduleDays: 'الإثنين,الأربعاء',
          scheduleTime: '05:00 PM',
          maxCapacity: 30,
          isActive: true,
        },
      });
    }

    // Group 4: Arabic Group (Code: ARB-06-A)
    if (arabicSubject) {
      await prisma.group.upsert({
        where: { groupCode: 'ARB-06-A' },
        update: {},
        create: {
          name: 'الصف السادس - مجموعة لغتي الجميلة',
          teacherId: teacher1.id,
          subjectId: arabicSubject.id,
          stageId: primaryStage.id,
          gradeLevelId: primary6Grade.id,
          groupCode: 'ARB-06-A',
          scheduleDays: 'السبت,الإثنين,الأربعاء',
          scheduleTime: '04:00 PM',
          maxCapacity: 50,
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Seeding completed with multiple groups, assignments, and exams!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
