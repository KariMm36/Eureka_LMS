import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export class HomeworkService {
  /**
   * 1. Get student homework feed with tabs (pending / completed)
   * Matches Screen 5 in UI (الواجبات قيد الحل vs الواجبات المنجزة)
   */
  static async getStudentHomeworkFeed(userId, status = 'all') {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { groupId: true },
        },
      },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const enrolledGroupIds = studentProfile.enrollments.map((e) => e.groupId);
    const now = new Date();

    // Fetch all homework for enrolled groups
    const homeworkList = await prisma.homework.findMany({
      where: {
        groupId: { in: enrolledGroupIds },
      },
      include: {
        group: {
          include: {
            subject: true,
            teacher: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        submissions: {
          where: { studentId: studentProfile.id },
        },
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Format and filter
    const formatted = homeworkList.map((hw) => {
      const submission = hw.submissions[0] || null;
      const isCompleted = !!submission;
      const diffTime = Math.abs(new Date(hw.dueDate) - now);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: hw.id,
        groupId: hw.groupId,
        groupName: hw.group.name,
        subjectName: hw.group.subject.nameAr,
        subjectIcon: hw.group.subject.iconUrl,
        teacherName: hw.group.teacher.fullName,
        title: hw.title,
        unitName: hw.unitName,
        durationMinutes: hw.durationMinutes,
        totalScore: hw.totalScore,
        questionCount: hw._count.questions,
        dueDate: hw.dueDate,
        isCompleted,
        daysRemaining: diffDays,
        dueText: isCompleted
          ? 'تم التسليم'
          : diffDays === 1
          ? 'ينتهي غداً'
          : `ينتهي بعد ${diffDays} أيام`,
        submission: submission
          ? {
              id: submission.id,
              totalScoreObtained: submission.totalScoreObtained,
              status: submission.status,
              submittedAt: submission.submittedAt,
            }
          : null,
      };
    });

    if (status === 'pending') {
      return formatted.filter((hw) => !hw.isCompleted);
    }
    if (status === 'completed') {
      return formatted.filter((hw) => hw.isCompleted);
    }

    return formatted;
  }

  /**
   * 2. Get Homework Details & Questions for Taking (Stripping answers for security)
   * Matches Screen 5 (Homework_MCQ, Homework_essay)
   */
  static async getHomeworkForTaking(userId, homeworkId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        group: {
          include: {
            subject: true,
            teacher: {
              select: { fullName: true },
            },
          },
        },
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            type: true,
            questionText: true,
            options: true,
            minWords: true,
            score: true,
            order: true,
          },
        },
      },
    });

    if (!homework) {
      throw ApiError.notFound('الواجب غير موجود');
    }

    // Parse JSON options for MCQ
    const sanitizedQuestions = homework.questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : [],
    }));

    return {
      id: homework.id,
      title: homework.title,
      unitName: homework.unitName,
      subjectName: homework.group.subject.nameAr,
      durationMinutes: homework.durationMinutes,
      totalScore: homework.totalScore,
      totalQuestions: sanitizedQuestions.length,
      dueDate: homework.dueDate,
      questions: sanitizedQuestions,
    };
  }

  /**
   * 3. Submit Homework & Auto-grade MCQs
   */
  static async submitHomework(userId, homeworkId, { answers, timeAnalytics }) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!homework) {
      throw ApiError.notFound('الواجب غير موجود');
    }

    // Check existing submission
    const existing = await prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: studentProfile.id,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('لقد قمت بتسليم هذا الواجب مسبقاً');
    }

    // Auto-grade MCQs & process answers
    let totalScoreObtained = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let underReviewCount = 0;

    const evaluatedAnswers = answers.map((ans, idx) => {
      const question = homework.questions.find((q) => q.order === ans.questionOrder || q.id === ans.questionId) || homework.questions[idx];

      if (!question) return ans;

      if (question.type === 'MCQ') {
        const isCorrect = ans.selectedOption === question.correctOptionIndex;
        const scoreObtained = isCorrect ? question.score : 0;
        if (isCorrect) correctCount++;
        else wrongCount++;
        totalScoreObtained += scoreObtained;

        return {
          questionId: question.id,
          questionOrder: question.order,
          questionText: question.questionText,
          selectedOption: ans.selectedOption,
          correctOptionIndex: question.correctOptionIndex,
          isCorrect,
          scoreObtained,
          maxScore: question.score,
          timeSpentSeconds: ans.timeSpentSeconds || 0,
        };
      } else {
        // Essay Question
        underReviewCount++;
        return {
          questionId: question.id,
          questionOrder: question.order,
          questionText: question.questionText,
          essayText: ans.essayText,
          isUnderReview: true,
          scoreObtained: 0, // Pending teacher manual review
          maxScore: question.score,
          timeSpentSeconds: ans.timeSpentSeconds || 0,
        };
      }
    });

    const submission = await prisma.homeworkSubmission.create({
      data: {
        homeworkId,
        studentId: studentProfile.id,
        answersJson: JSON.stringify(evaluatedAnswers),
        totalScoreObtained,
        correctCount,
        wrongCount,
        underReviewCount,
        percentileText: 'أنت ضمن أعلى 20% من الطلاب',
        averageTimePerQuestionSec: timeAnalytics?.averageTimePerQuestionSec || 30,
        fastestQuestionSec: timeAnalytics?.fastestQuestionSec || 15,
        slowestQuestionSec: timeAnalytics?.slowestQuestionSec || 60,
        status: underReviewCount > 0 ? 'UNDER_REVIEW' : 'GRADED',
      },
    });

    return {
      submissionId: submission.id,
      totalScoreObtained,
      maxScore: homework.totalScore,
      correctCount,
      wrongCount,
      underReviewCount,
      percentileText: submission.percentileText,
      status: submission.status,
    };
  }

  /**
   * 4. Get Homework Result & Review Screen
   * Matches Screen 5 (Homework_result)
   */
  static async getHomeworkResult(userId, homeworkId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const submission = await prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: studentProfile.id,
        },
      },
      include: {
        homework: {
          include: {
            group: {
              include: { subject: true },
            },
          },
        },
      },
    });

    if (!submission) {
      throw ApiError.notFound('لم يتم العثور على نتيجة لهذا الواجب');
    }

    const answers = JSON.parse(submission.answersJson || '[]');

    return {
      homeworkId: submission.homeworkId,
      title: submission.homework.title,
      subjectName: submission.homework.group.subject.nameAr,
      totalScoreObtained: submission.totalScoreObtained,
      totalScoreMax: submission.homework.totalScore,
      correctCount: submission.correctCount,
      underReviewCount: submission.underReviewCount,
      wrongCount: submission.wrongCount,
      percentileText: submission.percentileText,
      timeAnalytics: {
        averageTimePerQuestionSec: submission.averageTimePerQuestionSec,
        fastestQuestionSec: submission.fastestQuestionSec,
        slowestQuestionSec: submission.slowestQuestionSec,
      },
      submittedAt: submission.submittedAt,
      answersReview: answers,
    };
  }
}
