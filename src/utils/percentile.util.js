import prisma from '../config/prisma.js';

/**
 * Compute a student's percentile rank for a homework submission.
 * "What % of students in the same group scored lower than this student?"
 *
 * @param {string} homeworkId
 * @param {number} studentScore  - the student's totalScoreObtained
 * @returns {string}             - Arabic percentile text badge
 */
export const computeHomeworkPercentile = async (homeworkId, studentScore) => {
  // Count how many submissions exist for this homework
  const totalSubmissions = await prisma.homeworkSubmission.count({
    where: { homeworkId },
  });

  if (totalSubmissions <= 1) {
    // Only this student has submitted — can't rank yet
    return 'أول من أنجز هذا الواجب 🏆';
  }

  // Count how many students scored strictly less than this student
  const scoredLower = await prisma.homeworkSubmission.count({
    where: {
      homeworkId,
      totalScoreObtained: { lt: studentScore },
    },
  });

  const percentile = Math.round((scoredLower / (totalSubmissions - 1)) * 100);
  return formatPercentileBadge(percentile);
};

/**
 * Compute a student's percentile rank for an exam submission.
 *
 * @param {string} examId
 * @param {number} studentScore  - the student's totalScoreObtained
 * @returns {string}             - Arabic percentile text badge
 */
export const computeExamPercentile = async (examId, studentScore) => {
  const totalSubmissions = await prisma.examSubmission.count({
    where: { examId },
  });

  if (totalSubmissions <= 1) {
    return 'أول من أنجز هذا الامتحان 🏆';
  }

  const scoredLower = await prisma.examSubmission.count({
    where: {
      examId,
      totalScoreObtained: { lt: studentScore },
    },
  });

  const percentile = Math.round((scoredLower / (totalSubmissions - 1)) * 100);
  return formatPercentileBadge(percentile);
};

/**
 * Convert a percentile number into a human-readable Arabic badge.
 */
const formatPercentileBadge = (percentile) => {
  if (percentile >= 90) return `أنت ضمن أعلى 10% من الطلاب 🥇`;
  if (percentile >= 75) return `أنت ضمن أعلى 25% من الطلاب 🥈`;
  if (percentile >= 50) return `أنت ضمن أعلى 50% من الطلاب 🥉`;
  if (percentile >= 25) return `أنت ضمن أعلى 75% من الطلاب`;
  return `واصل المحاولة لتحسين ترتيبك`;
};
