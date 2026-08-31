import prisma from '../../../config/prisma.js';
import { ApiError } from '../../../utils/apiError.js';

export class AdminStudentsService {
  /**
   * Get 360° Student Academic & Lifetime History
   */
  static async getStudentAcademicHistory(studentProfileId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
          },
        },
        stage: true,
        gradeLevel: true,
        selectedSubjects: { include: { subject: true } },
        enrollments: {
          include: {
            group: {
              include: {
                subject: true,
                teacher: { select: { id: true, fullName: true, phone: true } },
              },
            },
          },
        },
        attendances: {
          include: {
            session: {
              include: {
                group: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { recordedAt: 'desc' },
        },
        homeworkSubmissions: {
          include: {
            homework: {
              select: { id: true, title: true, totalScore: true, groupId: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
        examSubmissions: {
          include: {
            exam: {
              select: { id: true, title: true, totalScore: true, passingScorePercentage: true, groupId: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
        payments: {
          include: {
            group: { select: { id: true, name: true } },
            teacher: { select: { id: true, fullName: true } },
          },
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    if (!studentProfile) {
      throw ApiError.notFound('بروفايل الطالب غير موجود');
    }

    // Compute aggregated metrics
    const totalSessions = studentProfile.attendances.length;
    const presentSessions = studentProfile.attendances.filter((a) => a.status === 'PRESENT').length;
    const attendancePercentage = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 100;

    const totalHomeworksSubmitted = studentProfile.homeworkSubmissions.length;
    const totalExamsAttempted = studentProfile.examSubmissions.length;

    return {
      student: {
        id: studentProfile.user.id,
        studentProfileId: studentProfile.id,
        fullName: studentProfile.user.fullName,
        email: studentProfile.user.email,
        phone: studentProfile.user.phone,
        parentPhone: studentProfile.parentPhone,
        stage: studentProfile.stage?.nameAr,
        gradeLevel: studentProfile.gradeLevel?.nameAr,
        isActive: studentProfile.user.isActive,
        registeredAt: studentProfile.user.createdAt,
      },
      summaryMetrics: {
        totalSessions,
        presentSessions,
        attendancePercentage,
        totalHomeworksSubmitted,
        totalExamsAttempted,
        totalPaymentsRecorded: studentProfile.payments.length,
      },
      enrolledGroups: studentProfile.enrollments.map((e) => ({
        enrollmentId: e.id,
        groupId: e.groupId,
        groupName: e.group.name,
        groupCode: e.group.groupCode,
        subjectName: e.group.subject?.nameAr,
        teacherName: e.group.teacher?.fullName,
        enrollmentStatus: e.status,
        enrolledAt: e.enrolledAt,
      })),
      recentAttendance: studentProfile.attendances.slice(0, 15).map((a) => ({
        id: a.id,
        groupName: a.session.group?.name,
        sessionTitle: a.session.title,
        status: a.status,
        date: a.recordedAt,
      })),
      homeworkSubmissions: studentProfile.homeworkSubmissions.map((h) => ({
        id: h.id,
        homeworkTitle: h.homework.title,
        scoreObtained: h.totalScoreObtained,
        totalScore: h.homework.totalScore,
        status: h.status,
        submittedAt: h.submittedAt,
      })),
      examAttempts: studentProfile.examSubmissions.map((ex) => ({
        id: ex.id,
        examTitle: ex.exam.title,
        scoreObtained: ex.totalScoreObtained,
        totalScore: ex.exam.totalScore,
        passed: ex.passed,
        submittedAt: ex.submittedAt,
      })),
      paymentHistory: studentProfile.payments.map((p) => ({
        id: p.id,
        groupName: p.group?.name,
        teacherName: p.teacher?.fullName,
        amount: Number(p.amount),
        monthLabel: p.monthLabel,
        paymentMethod: p.paymentMethod,
        paidAt: p.paidAt,
        receiptUrl: p.receiptUrl,
      })),
    };
  }
}
