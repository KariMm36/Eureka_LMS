import prisma from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

export class ExamService {
  /**
   * 1. Get student exams feed with filter tabs (all / available / completed / upcoming)
   * Matches Screen 6 in UI (Arabic_exam_essay, exams tabs)
   */
  static async getStudentExamsFeed(userId, tab = 'all') {
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

    const exams = await prisma.exam.findMany({
      where: {
        groupId: { in: enrolledGroupIds },
      },
      include: {
        group: {
          include: {
            subject: true,
            teacher: {
              select: { fullName: true, avatarUrl: true },
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
      orderBy: { startTime: 'asc' },
    });

    const formatted = exams.map((ex) => {
      const submission = ex.submissions[0] || null;
      const isCompleted = !!submission;
      const isAvailable = now >= new Date(ex.startTime) && now <= new Date(ex.endTime) && !isCompleted;
      const isUpcoming = now < new Date(ex.startTime);

      let statusKey = 'UPCOMING';
      let statusBadge = 'قريباً';

      if (isCompleted) {
        statusKey = 'COMPLETED';
        statusBadge = `مكتمل (${Math.round(submission.scorePercentage)}%)`;
      } else if (isAvailable) {
        statusKey = 'AVAILABLE';
        statusBadge = 'متاح الآن';
      }

      // Time remaining calculation for countdown
      const diffMs = new Date(ex.startTime) - now;
      const diffHrs = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      const diffMins = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));

      return {
        id: ex.id,
        groupId: ex.groupId,
        groupName: ex.group.name,
        subjectName: ex.group.subject.nameAr,
        subjectIcon: ex.group.subject.iconUrl,
        teacherName: ex.group.teacher.fullName,
        title: ex.title,
        durationMinutes: ex.durationMinutes,
        totalScore: ex.totalScore,
        questionCount: ex._count.questions,
        startTime: ex.startTime,
        endTime: ex.endTime,
        statusKey,
        statusBadge,
        countdownText: isUpcoming ? `يبدأ بعد ${diffHrs}:${diffMins < 10 ? '0' : ''}${diffMins}:00` : null,
        submission: submission
          ? {
              id: submission.id,
              totalScoreObtained: submission.totalScoreObtained,
              scorePercentage: submission.scorePercentage,
              passed: submission.passed,
              submittedAt: submission.submittedAt,
            }
          : null,
      };
    });

    if (tab === 'available') {
      return formatted.filter((e) => e.statusKey === 'AVAILABLE');
    }
    if (tab === 'completed') {
      return formatted.filter((e) => e.statusKey === 'COMPLETED');
    }
    if (tab === 'upcoming') {
      return formatted.filter((e) => e.statusKey === 'UPCOMING');
    }

    return formatted;
  }

  /**
   * 2. Get Exam Instructions & Rules
   * Matches Screen 6 (instructions)
   */
  static async getExamInstructions(userId, examId) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        group: {
          include: { subject: true },
        },
        _count: { select: { questions: true } },
      },
    });

    if (!exam) {
      throw ApiError.notFound('الامتحان غير موجود');
    }

    const guidelines = exam.guidelinesJson ? JSON.parse(exam.guidelinesJson) : [
      'إجمالي الأسئلة اختيار من متعدد وسؤال مقالي',
      `الحد الزمني ${exam.durationMinutes} دقيقة`,
      `درجة النجاح ${exam.passingScorePercentage}%`,
      'التنقل: يمكنك التنقل بين الأسئلة باستخدام أزرار السابق والتالي',
    ];

    return {
      examId: exam.id,
      title: exam.title,
      subjectName: exam.group.subject.nameAr,
      totalQuestions: exam._count.questions,
      durationMinutes: exam.durationMinutes,
      passingScorePercentage: exam.passingScorePercentage,
      totalScore: exam.totalScore,
      guidelines,
      legend: {
        answered: { label: 'سؤال تم الإجابة عليه', color: '#10b981' }, // Green
        review: { label: 'سؤال تمت مراجعته', color: '#3b82f6' },      // Blue
        unanswered: { label: 'سؤال لم تتم زيارته / لم يحل', color: '#ef4444' }, // Red
        notVisited: { label: 'غير مرئي', color: '#9ca3af' },          // Grey
      },
    };
  }

  /**
   * 3. Start Live Exam & Fetch Questions (Hides correct answers for security)
   * Matches Screen 6 (Arabic_exam_mcq, Arabic_exam_essay)
   */
  static async startExam(userId, examId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        group: { include: { subject: true } },
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            type: true,
            questionText: true,
            options: true,
            score: true,
            order: true,
          },
        },
      },
    });

    if (!exam) {
      throw ApiError.notFound('الامتحان غير موجود');
    }

    const sanitizedQuestions = exam.questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : [],
    }));

    return {
      examId: exam.id,
      title: exam.title,
      subjectName: exam.group.subject.nameAr,
      durationMinutes: exam.durationMinutes,
      totalScore: exam.totalScore,
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    };
  }

  /**
   * 4. Submit Exam Answers & Auto-grade
   */
  static async submitExam(userId, examId, { answers, timeAnalytics }) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam) {
      throw ApiError.notFound('الامتحان غير موجود');
    }

    // Check previous submission
    const existing = await prisma.examSubmission.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId: studentProfile.id,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('لقد قمت بإنهاء هذا الامتحان مسبقاً');
    }

    let totalScoreObtained = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let underReviewCount = 0;

    const evaluatedAnswers = answers.map((ans, idx) => {
      const question = exam.questions.find((q) => q.order === ans.questionOrder || q.id === ans.questionId) || exam.questions[idx];

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
          explanation: question.explanation,
          isCorrect,
          scoreObtained,
          maxScore: question.score,
          paletteStatus: ans.paletteStatus || (isCorrect ? 'ANSWERED' : 'UNANSWERED'),
          timeSpentSeconds: ans.timeSpentSeconds || 0,
        };
      } else {
        underReviewCount++;
        return {
          questionId: question.id,
          questionOrder: question.order,
          questionText: question.questionText,
          essayText: ans.essayText,
          isUnderReview: true,
          scoreObtained: 0,
          maxScore: question.score,
          paletteStatus: ans.paletteStatus || 'ANSWERED',
          timeSpentSeconds: ans.timeSpentSeconds || 0,
        };
      }
    });

    const scorePercentage = (totalScoreObtained / exam.totalScore) * 100;
    const passed = scorePercentage >= exam.passingScorePercentage;

    const submission = await prisma.examSubmission.create({
      data: {
        examId,
        studentId: studentProfile.id,
        answersJson: JSON.stringify(evaluatedAnswers),
        totalScoreObtained,
        scorePercentage,
        passed,
        correctCount,
        wrongCount,
        underReviewCount,
        averageTimePerQuestionSec: timeAnalytics?.averageTimePerQuestionSec || 45,
        fastestQuestionSec: timeAnalytics?.fastestQuestionSec || 20,
        slowestQuestionSec: timeAnalytics?.slowestQuestionSec || 120,
      },
    });

    return {
      submissionId: submission.id,
      totalScoreObtained,
      totalScoreMax: exam.totalScore,
      scorePercentage: Math.round(scorePercentage),
      passed,
      correctCount,
      wrongCount,
      underReviewCount,
    };
  }

  /**
   * 5. Get Exam Result Screen
   * Matches Screen 6 (exam_result)
   */
  static async getExamResult(userId, examId) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw ApiError.notFound('الملف الشخصي للطالب غير موجود');
    }

    const submission = await prisma.examSubmission.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId: studentProfile.id,
        },
      },
      include: {
        exam: {
          include: {
            group: { include: { subject: true } },
          },
        },
      },
    });

    if (!submission) {
      throw ApiError.notFound('لم يتم العثور على نتيجة لهذا الامتحان');
    }

    const answers = JSON.parse(submission.answersJson || '[]');

    return {
      examId: submission.examId,
      title: submission.exam.title,
      subjectName: submission.exam.group.subject.nameAr,
      totalScoreObtained: submission.totalScoreObtained,
      totalScoreMax: submission.exam.totalScore,
      scorePercentage: Math.round(submission.scorePercentage),
      passed: submission.passed,
      correctCount: submission.correctCount,
      underReviewCount: submission.underReviewCount,
      wrongCount: submission.wrongCount,
      percentileBadge: 'أنت ضمن أعلى 20% من الطلاب',
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
