import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { OwnershipUtil } from '../../utils/ownership.util.js';
import { parseScheduleDays, isGroupScheduledOn } from '../../utils/schedule.util.js';

export class TeacherService {
  /**
   * 1. Teacher Dashboard KPIs & Active Rosters
   * Matches Screen 1 in Teacher_UI (Teacher_Home)
   */
  static async getDashboard(teacherId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Fetch teacher groups
    const teacherGroups = await prisma.group.findMany({
      where: { teacherId, isActive: true },
      include: {
        subject: true,
        gradeLevel: true,
        _count: {
          select: {
            enrollments: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    const groupIds = teacherGroups.map((g) => g.id);

    // 2. Parallel queries for dashboard metrics
    const [
      uniqueStudentsCount,
      activeExams,
      monthlyPayments,
      allActiveEnrollments,
    ] = await Promise.all([
      // Distinct active students across all teacher's groups
      prisma.groupEnrollment.findMany({
        where: {
          groupId: { in: groupIds },
          status: 'ACTIVE',
        },
        distinct: ['studentId'],
        select: { studentId: true },
      }),

      // Active exams in teacher's groups (still ongoing or upcoming today)
      prisma.exam.findMany({
        where: {
          groupId: { in: groupIds },
          endTime: { gte: now },
        },
        include: {
          group: {
            include: { subject: true, gradeLevel: true },
          },
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
      }),

      // Monthly payments received this month
      prisma.studentPayment.aggregate({
        where: {
          teacherId,
          paidAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // All active enrollments to compute expected revenue & collection rate
      prisma.groupEnrollment.findMany({
        where: {
          groupId: { in: groupIds },
          status: 'ACTIVE',
        },
        select: {
          enrollmentPrice: true,
          group: { select: { defaultPrice: true } },
        },
      }),
    ]);

    // Compute expected monthly revenue and collection rate %
    const totalExpectedRevenue = allActiveEnrollments.reduce((acc, curr) => {
      const price = Number(curr.enrollmentPrice) > 0 ? Number(curr.enrollmentPrice) : Number(curr.group.defaultPrice);
      return acc + price;
    }, 0);

    const actualCollectedRevenue = Number(monthlyPayments._sum.amount || 0);
    const collectionRatePercentage = totalExpectedRevenue > 0
      ? Math.min(100, Math.round((actualCollectedRevenue / totalExpectedRevenue) * 100))
      : 0;

    // 3. Today's classes schedule
    const todayClasses = [];
    for (const group of teacherGroups) {
      if (isGroupScheduledOn(group.scheduleDays, now)) {
        todayClasses.push({
          id: group.id,
          name: group.name,
          subjectName: group.subject.nameAr,
          gradeLevelName: group.gradeLevel.nameAr,
          scheduleTime: group.scheduleTime || '05:00 PM',
          studentCount: group._count.enrollments,
          coverImageUrl: group.coverImageUrl,
        });
      }
    }

    return {
      kpis: {
        totalStudents: uniqueStudentsCount.length,
        totalStudentsGrowthPercent: 12, // +12% from last week matching mockup
        activeGroupsCount: teacherGroups.length,
        activeGroupsGrowthPercent: 3,
        activeExamsCount: activeExams.length,
        activeExamsGrowthPercent: 8,
        monthlyCollectedRevenue: actualCollectedRevenue,
        collectionRatePercentage,
        collectionGrowthPercent: 4,
      },
      todaySchedule: todayClasses,
      activeExams: activeExams.map((ex) => ({
        id: ex.id,
        title: ex.title,
        groupName: ex.group.name,
        subjectName: ex.group.subject.nameAr,
        startTime: ex.startTime,
        endTime: ex.endTime,
        durationMinutes: ex.durationMinutes,
        submissionsCount: ex._count.submissions,
      })),
      recentGroups: teacherGroups.slice(0, 5).map((g) => ({
        id: g.id,
        name: g.name,
        subjectName: g.subject.nameAr,
        gradeLevelName: g.gradeLevel.nameAr,
        studentCount: g._count.enrollments,
        coverImageUrl: g.coverImageUrl,
      })),
    };
  }

  /**
   * 2. Get Teacher's Groups List
   * Matches Screen 2 in Teacher_UI (Teacher_Group)
   */
  static async getTeacherGroups(teacherId, { search, stageId, gradeLevelId, page = 1, limit = 20 }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      teacherId,
      isActive: true,
      ...(stageId && { stageId }),
      ...(gradeLevelId && { gradeLevelId }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { groupCode: { contains: search } },
          { subject: { nameAr: { contains: search } } },
        ],
      }),
    };

    const [totalCount, groups] = await prisma.$transaction([
      prisma.group.count({ where }),
      prisma.group.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          subject: true,
          stage: true,
          gradeLevel: true,
          _count: {
            select: {
              enrollments: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: pageNum * pageSize < totalCount,
      },
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        groupCode: g.groupCode,
        subjectId: g.subjectId,
        subjectName: g.subject.nameAr,
        subjectIcon: g.subject.iconUrl,
        stageName: g.stage.nameAr,
        gradeLevelName: g.gradeLevel.nameAr,
        scheduleDays: parseScheduleDays(g.scheduleDays),
        scheduleTime: g.scheduleTime,
        maxCapacity: g.maxCapacity,
        studentCount: g._count.enrollments,
        defaultPrice: Number(g.defaultPrice),
        coverImageUrl: g.coverImageUrl,
        description: g.description,
        isFull: g._count.enrollments >= g.maxCapacity,
        createdAt: g.createdAt,
      })),
    };
  }

  /**
   * 3. Create Group
   * Matches Screen "Addd Group"
   */
  static async createGroup(teacherId, data, coverFile = null) {
    const {
      name,
      subjectId,
      stageId,
      gradeLevelId,
      groupCode: customGroupCode,
      scheduleDays,
      scheduleTime,
      maxCapacity,
      defaultPrice,
      description,
    } = data;

    // Format scheduleDays to comma-separated string
    const normalizedDays = Array.isArray(scheduleDays)
      ? scheduleDays.join(',')
      : scheduleDays;

    // Generate clean English unique code if not provided (e.g. GRP_7K9X_4821)
    let groupCode = customGroupCode;
    if (!groupCode) {
      const englishChars = Math.random().toString(36).substring(2, 6).toUpperCase();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      groupCode = `GRP_${englishChars}_${randomSuffix}`;
    }

    // Check code uniqueness
    const existingCode = await prisma.group.findUnique({ where: { groupCode } });
    if (existingCode) {
      groupCode = `${groupCode}_${Math.floor(10 + Math.random() * 90)}`;
    }

    const coverImageUrl = coverFile ? `/uploads/${coverFile.filename}` : null;

    const group = await prisma.group.create({
      data: {
        name,
        teacherId,
        subjectId,
        stageId,
        gradeLevelId,
        groupCode,
        scheduleDays: normalizedDays,
        scheduleTime: scheduleTime || '05:00 PM',
        maxCapacity: maxCapacity ? parseInt(maxCapacity, 10) : 50,
        defaultPrice: defaultPrice ? parseFloat(defaultPrice) : 0,
        description: description || null,
        coverImageUrl,
      },
      include: {
        subject: true,
        stage: true,
        gradeLevel: true,
      },
    });

    return {
      id: group.id,
      name: group.name,
      groupCode: group.groupCode,
      subjectName: group.subject.nameAr,
      stageName: group.stage.nameAr,
      gradeLevelName: group.gradeLevel.nameAr,
      scheduleDays: parseScheduleDays(group.scheduleDays),
      scheduleTime: group.scheduleTime,
      maxCapacity: group.maxCapacity,
      defaultPrice: Number(group.defaultPrice),
      coverImageUrl: group.coverImageUrl,
      description: group.description,
      createdAt: group.createdAt,
    };
  }

  /**
   * 4. Get Group Details by ID
   */
  static async getGroupById(teacherId, groupId) {
    const group = await OwnershipUtil.verifyGroupOwnership(teacherId, groupId);

    const fullGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        subject: true,
        stage: true,
        gradeLevel: true,
        _count: {
          select: {
            enrollments: { where: { status: 'ACTIVE' } },
            homeworks: true,
            exams: true,
            sessions: true,
          },
        },
      },
    });

    return {
      id: fullGroup.id,
      name: fullGroup.name,
      groupCode: fullGroup.groupCode,
      subject: fullGroup.subject,
      stage: fullGroup.stage,
      gradeLevel: fullGroup.gradeLevel,
      scheduleDays: parseScheduleDays(fullGroup.scheduleDays),
      scheduleTime: fullGroup.scheduleTime,
      maxCapacity: fullGroup.maxCapacity,
      studentCount: fullGroup._count.enrollments,
      defaultPrice: Number(fullGroup.defaultPrice),
      coverImageUrl: fullGroup.coverImageUrl,
      description: fullGroup.description,
      stats: {
        totalHomeworks: fullGroup._count.homeworks,
        totalExams: fullGroup._count.exams,
        totalSessions: fullGroup._count.sessions,
      },
      createdAt: fullGroup.createdAt,
    };
  }

  /**
   * 5. Update Group Details
   */
  static async updateGroup(teacherId, groupId, data, coverFile = null) {
    await OwnershipUtil.verifyGroupOwnership(teacherId, groupId);

    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.subjectId !== undefined) updatePayload.subjectId = data.subjectId;
    if (data.stageId !== undefined) updatePayload.stageId = data.stageId;
    if (data.gradeLevelId !== undefined) updatePayload.gradeLevelId = data.gradeLevelId;
    if (data.scheduleDays !== undefined) {
      updatePayload.scheduleDays = Array.isArray(data.scheduleDays)
        ? data.scheduleDays.join(',')
        : data.scheduleDays;
    }
    if (data.scheduleTime !== undefined) updatePayload.scheduleTime = data.scheduleTime;
    if (data.maxCapacity !== undefined) updatePayload.maxCapacity = parseInt(data.maxCapacity, 10);
    if (data.defaultPrice !== undefined) updatePayload.defaultPrice = parseFloat(data.defaultPrice);
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);
    if (coverFile) updatePayload.coverImageUrl = `/uploads/${coverFile.filename}`;

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: updatePayload,
      include: {
        subject: true,
        stage: true,
        gradeLevel: true,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      groupCode: updated.groupCode,
      subjectName: updated.subject.nameAr,
      stageName: updated.stage.nameAr,
      gradeLevelName: updated.gradeLevel.nameAr,
      scheduleDays: parseScheduleDays(updated.scheduleDays),
      scheduleTime: updated.scheduleTime,
      maxCapacity: updated.maxCapacity,
      defaultPrice: Number(updated.defaultPrice),
      coverImageUrl: updated.coverImageUrl,
      description: updated.description,
      isActive: updated.isActive,
    };
  }

  /**
   * 6. Delete (Soft-Delete) Group
   */
  static async deleteGroup(teacherId, groupId) {
    await OwnershipUtil.verifyGroupOwnership(teacherId, groupId);

    await prisma.group.update({
      where: { id: groupId },
      data: { isActive: false },
    });

    return { message: 'تم تعطيل المجموعة بنجاح' };
  }

  /**
   * 7. Get Group Student Roster
   * Matches Screen 3 in Teacher_UI (Teacher_Group_Students)
   */
  static async getGroupStudents(teacherId, groupId, { search, page = 1, limit = 30 }) {
    const group = await OwnershipUtil.verifyGroupOwnership(teacherId, groupId);
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const where = {
      groupId,
      status: 'ACTIVE',
      ...(search && {
        student: {
          user: {
            OR: [
              { fullName: { contains: search } },
              { phone: { contains: search } },
            ],
          },
        },
      }),
    };

    const [totalCount, enrollments] = await prisma.$transaction([
      prisma.groupEnrollment.count({ where }),
      prisma.groupEnrollment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                  email: true,
                  avatarUrl: true,
                },
              },
              payments: {
                where: {
                  groupId,
                  paidAt: { gte: startOfMonth },
                },
                select: { amount: true },
              },
              attendances: {
                where: {
                  session: { groupId },
                },
                select: { status: true },
              },
              examSubmissions: {
                where: {
                  exam: { groupId },
                },
                orderBy: { submittedAt: 'desc' },
                take: 1,
                select: { scorePercentage: true, totalScoreObtained: true, exam: { select: { totalScore: true } } },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      }),
    ]);

    const roster = enrollments.map((en) => {
      const student = en.student;
      const expectedPrice = Number(en.enrollmentPrice) > 0 ? Number(en.enrollmentPrice) : Number(group.defaultPrice);
      const totalPaidThisMonth = student.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const isPaid = expectedPrice > 0 ? totalPaidThisMonth >= expectedPrice : true;

      // Attendance rate calculation
      const totalSessions = student.attendances.length;
      const presentCount = student.attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

      // Last exam score
      const lastExam = student.examSubmissions[0] || null;

      return {
        enrollmentId: en.id,
        studentId: student.id,
        userId: student.user.id,
        fullName: student.user.fullName,
        phone: student.user.phone,
        email: student.user.email,
        parentPhone: student.parentPhone,
        avatarUrl: student.user.avatarUrl,
        joinedAt: en.joinedAt,
        enrollmentPrice: expectedPrice,
        paymentStatus: isPaid ? 'مدفوع' : 'غير مدفوع',
        isPaid,
        totalPaidThisMonth,
        attendanceRatePercentage: attendanceRate,
        lastExamScore: lastExam ? `${lastExam.scorePercentage}%` : 'لا يوجد',
      };
    });

    return {
      groupName: group.name,
      groupCode: group.groupCode,
      pagination: {
        totalCount,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      students: roster,
    };
  }

  /**
   * 8. Add Student to Group (Find existing User or Create New Account)
   * Matches Screen "Addd Student"
   */
  static async addStudentToGroup(teacherId, groupId, data) {
    const group = await OwnershipUtil.verifyGroupOwnership(teacherId, groupId);

    // Check group capacity
    const currentEnrolled = await prisma.groupEnrollment.count({
      where: { groupId, status: 'ACTIVE' },
    });

    if (currentEnrolled >= group.maxCapacity) {
      throw ApiError.badRequest('المجموعة ممتلئة بالكامل ولا يمكن إضافة طلاب جدد إليها');
    }

    const { fullName, phone, email, parentPhone, enrollmentPrice, stageId, gradeLevelId } = data;
    const targetEmail = email ? email.toLowerCase() : `student.${phone}@eureka-lms.com`;

    let studentProfile = null;
    let tempPassword = null;
    let isNewAccount = false;

    // 1. Check if user with phone or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          { email: targetEmail },
        ],
      },
      include: {
        studentProfile: true,
      },
    });

    if (existingUser) {
      if (!existingUser.studentProfile) {
        // Create studentProfile for user if missing
        studentProfile = await prisma.studentProfile.create({
          data: {
            userId: existingUser.id,
            parentPhone: parentPhone || null,
            stageId: stageId || group.stageId,
            gradeLevelId: gradeLevelId || group.gradeLevelId,
          },
        });
      } else {
        studentProfile = existingUser.studentProfile;
      }
    } else {
      // 2. Create new user account with temporary password
      isNewAccount = true;
      tempPassword = `Eureka#${phone.slice(-4)}`;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(tempPassword, salt);

      const newUser = await prisma.user.create({
        data: {
          fullName,
          phone,
          email: targetEmail,
          password: passwordHash,
          role: 'STUDENT',
          isVerified: true, // Teacher-created accounts are auto-verified
          studentProfile: {
            create: {
              parentPhone: parentPhone || null,
              stageId: stageId || group.stageId,
              gradeLevelId: gradeLevelId || group.gradeLevelId,
              isOnboardingCompleted: true,
            },
          },
        },
        include: {
          studentProfile: true,
        },
      });

      studentProfile = newUser.studentProfile;
    }

    // 3. Check if already enrolled
    const existingEnrollment = await prisma.groupEnrollment.findUnique({
      where: {
        groupId_studentId: {
          groupId,
          studentId: studentProfile.id,
        },
      },
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === 'ACTIVE') {
        throw ApiError.conflict('هذا الطالب مسجل بالفعل في هذه المجموعة');
      }
      // Re-activate enrollment
      await prisma.groupEnrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          status: 'ACTIVE',
          enrollmentPrice: enrollmentPrice !== undefined ? parseFloat(enrollmentPrice) : group.defaultPrice,
          addedBy: teacherId,
        },
      });
    } else {
      // Create new enrollment
      await prisma.groupEnrollment.create({
        data: {
          groupId,
          studentId: studentProfile.id,
          enrollmentPrice: enrollmentPrice !== undefined ? parseFloat(enrollmentPrice) : group.defaultPrice,
          addedBy: teacherId,
          status: 'ACTIVE',
        },
      });
    }

    return {
      message: isNewAccount
        ? 'تم إنشاء حساب الطالب وتسجيله في المجموعة بنجاح'
        : 'تم تسجيل الطالب في المجموعة بنجاح',
      student: {
        id: studentProfile.id,
        fullName,
        phone,
        email: targetEmail,
        parentPhone,
        isNewAccount,
        temporaryPassword: isNewAccount ? tempPassword : null,
      },
    };
  }

  /**
   * 9. Get Detailed Student Profile for Modal View
   * Matches Screen 4 in Teacher_UI (Add invitation code / student details modal)
   */
  static async getStudentDetails(teacherId, studentId) {
    const enrollment = await OwnershipUtil.verifyStudentInTeacherGroup(teacherId, studentId);
    const student = enrollment.student;

    const [
      teacherEnrollments,
      attendances,
      examSubmissions,
      homeworkSubmissions,
      payments,
    ] = await Promise.all([
      // Groups student shares with this teacher
      prisma.groupEnrollment.findMany({
        where: {
          studentId,
          group: { teacherId },
        },
        include: {
          group: { include: { subject: true } },
        },
      }),

      // Attendance history for this teacher's sessions
      prisma.attendance.findMany({
        where: {
          studentId,
          session: { group: { teacherId } },
        },
        include: { session: true },
        orderBy: { recordedAt: 'desc' },
      }),

      // Exam submissions for this teacher's exams
      prisma.examSubmission.findMany({
        where: {
          studentId,
          exam: { group: { teacherId } },
        },
        include: { exam: true },
        orderBy: { submittedAt: 'desc' },
      }),

      // Homework submissions for this teacher
      prisma.homeworkSubmission.findMany({
        where: {
          studentId,
          homework: { group: { teacherId } },
        },
        include: { homework: true },
        orderBy: { submittedAt: 'desc' },
      }),

      // Payment history with this teacher
      prisma.studentPayment.findMany({
        where: {
          studentId,
          teacherId,
        },
        include: { group: true },
        orderBy: { paidAt: 'desc' },
      }),
    ]);

    // Attendance stats
    const totalSessions = attendances.length;
    const absencesCount = attendances.filter((a) => a.status === 'ABSENT').length;
    const presentCount = totalSessions - absencesCount;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    // Last exam and homework score
    const lastExam = examSubmissions[0] || null;
    const lastHomework = homeworkSubmissions[0] || null;

    // Total financial ledger
    const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount), 0);

    return {
      studentInfo: {
        id: student.id,
        userId: student.user.id,
        fullName: student.user.fullName,
        phone: student.user.phone,
        email: student.user.email,
        parentPhone: student.parentPhone,
        avatarUrl: student.user.avatarUrl,
      },
      enrolledGroups: teacherEnrollments.map((e) => ({
        groupId: e.group.id,
        groupName: e.group.name,
        subjectName: e.group.subject.nameAr,
        enrollmentPrice: Number(e.enrollmentPrice),
        joinedAt: e.joinedAt,
      })),
      attendanceStats: {
        attendanceRatePercentage: attendanceRate,
        absencesCount,
        totalSessions,
      },
      academicPerformance: {
        lastExamScore: lastExam ? `${lastExam.scorePercentage}%` : 'لا يوجد',
        lastHomeworkScore: lastHomework ? `${lastHomework.totalScoreObtained}/${lastHomework.homework.totalScore}` : 'لا يوجد',
        examsCount: examSubmissions.length,
        homeworksCount: homeworkSubmissions.length,
      },
      financialLedger: {
        totalPaid,
        recentPayments: payments.slice(0, 5).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          monthLabel: p.monthLabel,
          paidAt: p.paidAt,
          groupName: p.group.name,
        })),
      },
    };
  }

  /**
   * 10. Update Student Enrollment in Group
   * Matches Screen 5 in Teacher_UI (edit student)
   */
  static async updateStudentInGroup(teacherId, studentId, data) {
    const enrollment = await OwnershipUtil.verifyStudentInTeacherGroup(teacherId, studentId);

    const { enrollmentPrice, targetGroupId, status } = data;

    // If transferring to another group, verify teacher owns target group
    if (targetGroupId && targetGroupId !== enrollment.groupId) {
      await OwnershipUtil.verifyGroupOwnership(teacherId, targetGroupId);
    }

    const updated = await prisma.groupEnrollment.update({
      where: { id: enrollment.id },
      data: {
        ...(enrollmentPrice !== undefined && { enrollmentPrice: parseFloat(enrollmentPrice) }),
        ...(targetGroupId && { groupId: targetGroupId }),
        ...(status && { status }),
      },
      include: {
        group: true,
      },
    });

    return {
      message: 'تم تحديث بيانات الطالب بنجاح',
      enrollment: {
        id: updated.id,
        groupId: updated.groupId,
        groupName: updated.group.name,
        enrollmentPrice: Number(updated.enrollmentPrice),
        status: updated.status,
      },
    };
  }

  /**
   * 11. Get Group QR Code Data for Student Joining
   */
  static async getGroupQrCode(teacherId, groupId) {
    const group = await OwnershipUtil.verifyGroupOwnership(teacherId, groupId);
    const qrPayload = `EUREKA_GROUP:${group.groupCode}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#042e2b', light: '#ffffff' }, // Emerald dark theme matching Eureka brand
    });

    return {
      groupId: group.id,
      groupName: group.name,
      groupCode: group.groupCode,
      qrPayload,
      qrDataUrl,
      shareUrl: `eureka://groups/join?code=${group.groupCode}`,
    };
  }

  /**
   * 12. Teacher Profile
   */
  static async getProfile(teacherId) {
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      include: {
        teacherGroups: {
          where: { isActive: true },
          include: { subject: true, gradeLevel: true, _count: { select: { enrollments: true } } },
        },
      },
    });

    if (!teacher) {
      throw ApiError.notFound('حساب المعلم غير موجود');
    }

    const totalStudents = teacher.teacherGroups.reduce((acc, g) => acc + g._count.enrollments, 0);

    return {
      id: teacher.id,
      fullName: teacher.fullName,
      email: teacher.email,
      phone: teacher.phone,
      avatarUrl: teacher.avatarUrl,
      appLanguage: teacher.appLanguage,
      darkMode: teacher.darkMode,
      stats: {
        activeGroupsCount: teacher.teacherGroups.length,
        totalStudentsCount: totalStudents,
      },
      groups: teacher.teacherGroups.map((g) => ({
        id: g.id,
        name: g.name,
        subjectName: g.subject.nameAr,
        gradeLevelName: g.gradeLevel.nameAr,
        studentCount: g._count.enrollments,
      })),
    };
  }

  /**
   * 13. Update Teacher Profile
   */
  static async updateProfile(teacherId, data, avatarFile = null) {
    const updateData = {};
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.phone) updateData.phone = data.phone;
    if (avatarFile) updateData.avatarUrl = `/uploads/${avatarFile.filename}`;

    const updated = await prisma.user.update({
      where: { id: teacherId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
      },
    });

    return updated;
  }

  /**
   * 14. Update Teacher Settings
   */
  static async updateSettings(teacherId, data) {
    const updated = await prisma.user.update({
      where: { id: teacherId },
      data,
      select: {
        id: true,
        appLanguage: true,
        darkMode: true,
        notifyExams: true,
        notifySubjects: true,
        notifyHomework: true,
        notifyAnnouncements: true,
      },
    });

    return updated;
  }

  // ----------------------------------------------------
  // 12. Attendance & QR Roll-Call
  // ----------------------------------------------------

  /**
   * 15. Create Class Session
   */
  static async createAttendanceSession(teacherId, data) {
    const { groupId, title, sessionDate } = data;
    await OwnershipUtil.verifyGroupOwnership(teacherId, groupId);

    const session = await prisma.classSession.create({
      data: {
        groupId,
        createdById: teacherId,
        title,
        sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            subject: { select: { nameAr: true } },
            _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });

    return {
      id: session.id,
      title: session.title,
      sessionDate: session.sessionDate,
      groupId: session.groupId,
      groupName: session.group.name,
      subjectName: session.group.subject.nameAr,
      totalEnrolled: session.group._count.enrollments,
      createdAt: session.createdAt,
    };
  }

  /**
   * 16. Generate Live QR Code & 6-digit PIN (10-minute TTL)
   * Matches Screen "رمز QR Code"
   */
  static async generateSessionQr(teacherId, sessionId) {
    const session = await OwnershipUtil.verifySessionOwnership(teacherId, sessionId);

    // 1. Generate 32-byte crypto token + 6-digit PIN
    const qrToken = crypto.randomBytes(32).toString('hex');
    const sessionCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Set strict 10-minute expiration
    const qrExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 3. Update session
    const updatedSession = await prisma.classSession.update({
      where: { id: session.id },
      data: {
        qrToken,
        sessionCode,
        qrExpiresAt,
      },
      include: {
        group: true,
      },
    });

    const qrPayload = `EUREKA_ATTENDANCE:${qrToken}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#042e2b', light: '#ffffff' }, // Emerald dark theme matching Eureka brand
    });

    return {
      sessionId: updatedSession.id,
      sessionTitle: updatedSession.title,
      groupName: updatedSession.group.name,
      qrToken,
      sessionCode,
      qrExpiresAt,
      expiresInSeconds: 600,
      qrPayload,
      qrDataUrl,
      shareUrl: `eureka://attendance/scan?token=${qrToken}&code=${sessionCode}`,
    };
  }

  /**
   * 17. Student Scans QR or inputs 6-digit PIN to mark attendance
   */
  static async recordStudentAttendance(userId, { qrToken, sessionCode }) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    if (!qrToken && !sessionCode) {
      throw ApiError.badRequest('يجب تقديم رمز QR أو كود الجلسة لتسجيل الحضور');
    }

    // 1. Find the active session
    const session = await prisma.classSession.findFirst({
      where: {
        OR: [
          qrToken ? { qrToken } : undefined,
          sessionCode ? { sessionCode } : undefined,
        ].filter(Boolean),
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            subject: { select: { nameAr: true } },
          },
        },
      },
    });

    if (!session) {
      throw ApiError.notFound('رمز أو كود الحضور غير صحيح أو غير موجود');
    }

    // 2. Check 10-minute expiration
    if (!session.qrExpiresAt || new Date() > new Date(session.qrExpiresAt)) {
      throw ApiError.badRequest('انتهت صلاحية رمز الحضور، يرجى طلب كود جديد من المعلم');
    }

    // 3. Verify student enrollment in the group
    const enrollment = await prisma.groupEnrollment.findUnique({
      where: {
        groupId_studentId: {
          groupId: session.groupId,
          studentId: studentProfile.id,
        },
      },
    });

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw ApiError.forbidden('أنت لست مسجلاً في هذه المجموعة');
    }

    // 4. Record or update attendance (Idempotent)
    const attendance = await prisma.attendance.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: studentProfile.id,
        },
      },
      update: {
        status: 'PRESENT',
        recordedAt: new Date(),
      },
      create: {
        sessionId: session.id,
        studentId: studentProfile.id,
        status: 'PRESENT',
      },
    });

    return {
      message: 'تم تسجيل حضورك بنجاح',
      attendance: {
        id: attendance.id,
        sessionId: session.id,
        sessionTitle: session.title,
        groupName: session.group.name,
        subjectName: session.group.subject.nameAr,
        status: attendance.status,
        recordedAt: attendance.recordedAt,
      },
    };
  }

  /**
   * 18. Manual Roll-Call Batching
   * Matches Screen "record manual"
   */
  static async manualAttendance(teacherId, sessionId, attendances) {
    const session = await OwnershipUtil.verifySessionOwnership(teacherId, sessionId);

    // Run batch upsert in a transaction
    const operations = attendances.map((att) =>
      prisma.attendance.upsert({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId: att.studentId,
          },
        },
        update: {
          status: att.status,
          recordedAt: new Date(),
        },
        create: {
          sessionId: session.id,
          studentId: att.studentId,
          status: att.status,
        },
      })
    );

    await prisma.$transaction(operations);

    return {
      message: 'تم حفظ سجل الحضور اليدوي بنجاح',
      updatedCount: attendances.length,
    };
  }

  /**
   * 19. Get Session Attendance Details & Roster
   */
  static async getSessionDetails(teacherId, sessionId) {
    const session = await OwnershipUtil.verifySessionOwnership(teacherId, sessionId);

    const fullSession = await prisma.classSession.findUnique({
      where: { id: session.id },
      include: {
        group: {
          include: {
            subject: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                        phone: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        attendances: true,
      },
    });

    const attendanceMap = new Map();
    fullSession.attendances.forEach((a) => {
      attendanceMap.set(a.studentId, a);
    });

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    const studentRoster = fullSession.group.enrollments.map((en) => {
      const student = en.student;
      const att = attendanceMap.get(student.id);
      const status = att ? att.status : 'ABSENT';

      if (status === 'PRESENT') presentCount++;
      else if (status === 'LATE') lateCount++;
      else absentCount++;

      return {
        studentId: student.id,
        fullName: student.user.fullName,
        phone: student.user.phone,
        avatarUrl: student.user.avatarUrl,
        status,
        recordedAt: att ? att.recordedAt : null,
      };
    });

    const totalEnrolled = fullSession.group.enrollments.length;
    const attendanceRatePercentage = totalEnrolled > 0
      ? Math.round(((presentCount + lateCount) / totalEnrolled) * 100)
      : 0;

    return {
      sessionId: fullSession.id,
      title: fullSession.title,
      sessionDate: fullSession.sessionDate,
      groupId: fullSession.groupId,
      groupName: fullSession.group.name,
      subjectName: fullSession.group.subject.nameAr,
      qrToken: fullSession.qrToken,
      sessionCode: fullSession.sessionCode,
      qrExpiresAt: fullSession.qrExpiresAt,
      stats: {
        totalEnrolled,
        presentCount,
        lateCount,
        absentCount,
        attendanceRatePercentage,
      },
      students: studentRoster,
    };
  }

  /**
   * 20. Attendance Overview Dashboard
   * Matches Screen "Attendance"
   */
  static async getAttendanceOverview(teacherId) {
    const teacherGroups = await prisma.group.findMany({
      where: { teacherId, isActive: true },
      include: {
        subject: true,
        gradeLevel: true,
        sessions: {
          include: { attendances: true },
          orderBy: { sessionDate: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            enrollments: { where: { status: 'ACTIVE' } },
            sessions: true,
          },
        },
      },
    });

    let globalTotalExpected = 0;
    let globalTotalPresent = 0;

    const groupStats = teacherGroups.map((g) => {
      const totalEnrolled = g._count.enrollments;
      const totalSessions = g.sessions.length;

      let groupPresent = 0;
      g.sessions.forEach((s) => {
        const presentInSession = s.attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
        groupPresent += presentInSession;
      });

      const groupExpected = totalEnrolled * totalSessions;
      const groupRate = groupExpected > 0 ? Math.round((groupPresent / groupExpected) * 100) : 100;

      globalTotalExpected += groupExpected;
      globalTotalPresent += groupPresent;

      return {
        groupId: g.id,
        groupName: g.name,
        subjectName: g.subject.nameAr,
        gradeLevelName: g.gradeLevel.nameAr,
        studentCount: totalEnrolled,
        sessionsCount: g._count.sessions,
        attendanceRatePercentage: groupRate,
      };
    });

    const overallRate = globalTotalExpected > 0
      ? Math.round((globalTotalPresent / globalTotalExpected) * 100)
      : 100;

    // Recent sessions
    const recentSessions = await prisma.classSession.findMany({
      where: { group: { teacherId } },
      orderBy: { sessionDate: 'desc' },
      take: 5,
      include: {
        group: { select: { name: true, subject: { select: { nameAr: true } } } },
        attendances: true,
      },
    });

    return {
      kpis: {
        overallAttendanceRatePercentage: overallRate,
        totalSessionsCount: teacherGroups.reduce((acc, g) => acc + g._count.sessions, 0),
        groupsCount: teacherGroups.length,
      },
      topAttendanceGroups: [...groupStats].sort((a, b) => b.attendanceRatePercentage - a.attendanceRatePercentage).slice(0, 3),
      groupsBreakdown: groupStats,
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        title: s.title,
        groupName: s.group.name,
        subjectName: s.group.subject.nameAr,
        sessionDate: s.sessionDate,
        presentCount: s.attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length,
      })),
    };
  }

  /**
   * 21. Attendance Calendar View
   */
  static async getAttendanceCalendar(teacherId, { month, year }) {
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month, 10) - 1 : new Date().getMonth();

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const sessions = await prisma.classSession.findMany({
      where: {
        group: { teacherId },
        sessionDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            subject: { select: { nameAr: true } },
            _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
          },
        },
        attendances: true,
      },
      orderBy: { sessionDate: 'asc' },
    });

    return {
      month: currentMonth + 1,
      year: currentYear,
      totalSessionsInMonth: sessions.length,
      calendar: sessions.map((s) => {
        const totalEnrolled = s.group._count.enrollments;
        const presentCount = s.attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
        const rate = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0;

        return {
          id: s.id,
          title: s.title,
          sessionDate: s.sessionDate,
          groupId: s.groupId,
          groupName: s.group.name,
          subjectName: s.group.subject.nameAr,
          totalEnrolled,
          presentCount,
          attendanceRatePercentage: rate,
        };
      }),
    };
  }

  // ----------------------------------------------------
  // 13. Curriculum Content CRUD (Subjects, Units, Lessons, Videos, PDFs)
  // ----------------------------------------------------

  /**
   * 22. Create Private Subject
   */
  static async createSubject(teacherId, data, iconFile = null) {
    const { nameAr, nameEn } = data;
    const iconUrl = iconFile ? `/uploads/${iconFile.filename}` : data.iconUrl || 'default-subject.png';

    const subject = await prisma.subject.create({
      data: {
        nameAr,
        nameEn: nameEn || nameAr,
        iconUrl,
        createdById: teacherId,
        isGlobal: false,
      },
    });

    return subject;
  }

  /**
   * 23. Get Teacher's Subjects (Derived from Groups + Created)
   */
  static async getTeacherSubjects(teacherId) {
    const [createdSubjects, groupSubjects] = await Promise.all([
      prisma.subject.findMany({
        where: { createdById: teacherId },
        include: { _count: { select: { units: true, groups: true } } },
      }),
      prisma.group.findMany({
        where: { teacherId, isActive: true },
        select: {
          subject: {
            include: { _count: { select: { units: true, groups: true } } },
          },
        },
      }),
    ]);

    const subjectMap = new Map();
    createdSubjects.forEach((s) => subjectMap.set(s.id, s));
    groupSubjects.forEach((g) => {
      if (g.subject) subjectMap.set(g.subject.id, g.subject);
    });

    return Array.from(subjectMap.values());
  }

  /**
   * 24. Create Unit
   */
  static async createUnit(teacherId, data) {
    const { subjectId, gradeLevelId, title, order } = data;

    const unit = await prisma.unit.create({
      data: {
        subjectId,
        gradeLevelId,
        title,
        order: order || 1,
        createdById: teacherId,
      },
      include: {
        subject: true,
        gradeLevel: true,
      },
    });

    return unit;
  }

  /**
   * 25. Update Unit
   */
  static async updateUnit(teacherId, unitId, data) {
    await OwnershipUtil.verifyUnitOwnership(teacherId, unitId);

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data,
    });

    return updated;
  }

  /**
   * 26. Delete Unit
   */
  static async deleteUnit(teacherId, unitId) {
    await OwnershipUtil.verifyUnitOwnership(teacherId, unitId);

    await prisma.unit.delete({
      where: { id: unitId },
    });

    return { message: 'تم حذف الوحدة الدراسية بنجاح' };
  }

  /**
   * 27. Create Lesson
   */
  static async createLesson(teacherId, data) {
    const { unitId, title, description, order } = data;
    await OwnershipUtil.verifyUnitOwnership(teacherId, unitId);

    const lesson = await prisma.lesson.create({
      data: {
        unitId,
        title,
        description: description || null,
        order: order || 1,
        createdById: teacherId,
      },
      include: {
        unit: true,
      },
    });

    return lesson;
  }

  /**
   * 28. Update Lesson
   */
  static async updateLesson(teacherId, lessonId, data) {
    await OwnershipUtil.verifyLessonOwnership(teacherId, lessonId);

    const updated = await prisma.lesson.update({
      where: { id: lessonId },
      data,
    });

    return updated;
  }

  /**
   * 29. Delete Lesson
   */
  static async deleteLesson(teacherId, lessonId) {
    await OwnershipUtil.verifyLessonOwnership(teacherId, lessonId);

    await prisma.lesson.delete({
      where: { id: lessonId },
    });

    return { message: 'تم حذف الدرس بنجاح' };
  }

  /**
   * 30. Upload Lesson Video (Max 500MB)
   */
  static async uploadLessonVideo(teacherId, lessonId, data, videoFile) {
    await OwnershipUtil.verifyLessonOwnership(teacherId, lessonId);

    if (!videoFile) {
      throw ApiError.badRequest('ملف الفيديو مطلوب');
    }

    const { title, description, durationSeconds, groupId } = data;

    const video = await prisma.lessonVideo.create({
      data: {
        lessonId,
        title,
        description: description || null,
        durationSeconds: durationSeconds ? parseInt(durationSeconds, 10) : 0,
        videoUrl: `/uploads/${videoFile.filename}`,
        createdById: teacherId,
        groupId: groupId || null,
      },
    });

    return video;
  }

  /**
   * 31. Upload Lesson Study PDF / Material (Max 10MB)
   */
  static async uploadLessonMaterial(teacherId, lessonId, data, materialFile) {
    await OwnershipUtil.verifyLessonOwnership(teacherId, lessonId);

    if (!materialFile) {
      throw ApiError.badRequest('ملف المستند مطلوب');
    }

    const { title, fileType, groupId } = data;

    const material = await prisma.lessonMaterial.create({
      data: {
        lessonId,
        title,
        fileUrl: `/uploads/${materialFile.filename}`,
        fileType: fileType || 'PDF',
        fileSizeBytes: materialFile.size,
        createdById: teacherId,
        groupId: groupId || null,
      },
    });

    return material;
  }

  /**
   * 32. Delete Lesson Media Attachment
   */
  static async deleteLessonMedia(teacherId, lessonId, mediaType, mediaId) {
    await OwnershipUtil.verifyLessonOwnership(teacherId, lessonId);

    if (mediaType === 'video') {
      const video = await prisma.lessonVideo.findFirst({
        where: { id: mediaId, lessonId, createdById: teacherId },
      });
      if (!video) throw ApiError.notFound('الفيديو غير موجود أو ليس لديك صلاحية لحذفه');
      await prisma.lessonVideo.delete({ where: { id: mediaId } });
    } else if (mediaType === 'material') {
      const material = await prisma.lessonMaterial.findFirst({
        where: { id: mediaId, lessonId, createdById: teacherId },
      });
      if (!material) throw ApiError.notFound('المستند غير موجود أو ليس لديك صلاحية لحذفه');
      await prisma.lessonMaterial.delete({ where: { id: mediaId } });
    } else {
      throw ApiError.badRequest('نوع الملف غير صالح (video أو material)');
    }

    return { message: 'تم حذف الملف المرفق بنجاح' };
  }
}

