import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { parseScheduleDays, isGroupScheduledOn } from '../../utils/schedule.util.js';

export class HomeService {
  /**
   * Aggregates all widgets for the student home dashboard
   */
  static async getHomeDashboard(userId) {
    const student = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: {
          include: {
            stage: true,
            gradeLevel: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                group: {
                  include: {
                    teacher: {
                      select: {
                        id: true,
                        fullName: true,
                        avatarUrl: true,
                      },
                    },
                    subject: true,
                  },
                },
              },
            },
          },
        },
        notifications: {
          where: { isRead: false },
          select: { id: true },
        },
      },
    });

    if (!student || !student.studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const enrolledGroupIds = student.studentProfile.enrollments.map((e) => e.groupId);

    // 1. Pending Homework across all enrolled groups
    const now = new Date();
    const pendingHomeworks = await prisma.homework.findMany({
      where: {
        groupId: { in: enrolledGroupIds },
        dueDate: { gte: now },
        submissions: {
          none: {
            studentId: student.studentProfile.id,
          },
        },
      },
      include: {
        group: {
          include: { subject: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    // 2. Upcoming Announcements / Exams
    const upcomingExams = await prisma.exam.findMany({
      where: {
        groupId: { in: enrolledGroupIds },
        endTime: { gte: now },
      },
      include: {
        group: {
          include: { subject: true },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    });

    // 3. Next Class Banner & Today's Schedule
    const todaySchedule = [];
    let nextClass = null;

    for (const enrollment of student.studentProfile.enrollments) {
      const g = enrollment.group;
      const days = parseScheduleDays(g.scheduleDays);

      if (isGroupScheduledOn(g.scheduleDays, now)) {
        todaySchedule.push({
          groupId: g.id,
          groupName: g.name,
          subjectName: g.subject.nameAr,
          teacherName: g.teacher.fullName,
          teacherAvatar: g.teacher.avatarUrl,
          time: g.scheduleTime || null,
        });
      }

      if (!nextClass && days.length > 0) {
        nextClass = {
          groupId: g.id,
          groupName: g.name,
          subjectName: g.subject.nameAr,
          teacherName: g.teacher.fullName,
          teacherAvatar: g.teacher.avatarUrl,
          day: days[0],
          time: g.scheduleTime || null,
        };
      }
    }

    return {
      studentInfo: {
        id: student.id,
        fullName: student.fullName,
        avatarUrl: student.avatarUrl,
        stageName: student.studentProfile.stage?.nameAr || null,
        gradeLevelName: student.studentProfile.gradeLevel?.nameAr || null,
        unreadNotificationsCount: student.notifications.length,
      },
      nextClass,
      todaySchedule,
      pendingHomework: pendingHomeworks.map((hw) => {
        const diffTime = Math.abs(new Date(hw.dueDate) - now);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          id: hw.id,
          groupId: hw.groupId,
          subjectName: hw.group.subject.nameAr,
          title: hw.title,
          unitName: hw.unitName,
          dueDate: hw.dueDate,
          daysRemaining: diffDays,
          dueText: diffDays === 1 ? 'غداً' : `بعد ${diffDays} أيام`,
        };
      }),
      announcements: upcomingExams.map((ex) => ({
        id: ex.id,
        groupId: ex.groupId,
        type: 'EXAM',
        subjectName: ex.group.subject.nameAr,
        title: ex.title,
        startTime: ex.startTime,
        endTime: ex.endTime,
        durationMinutes: ex.durationMinutes,
        statusText: now >= new Date(ex.startTime) && now <= new Date(ex.endTime) ? 'متاح الآن' : 'سيبدأ قريباً',
      })),
    };
  }
}
