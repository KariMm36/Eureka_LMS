import { ApiError } from './apiError.js';

/**
 * Counts words in a string (trims whitespace, ignores empty tokens).
 * Works correctly with Arabic text.
 */
export const countWords = (text = '') => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

/**
 * Validates an essay answer against a minimum word count.
 * Throws ApiError.badRequest if the answer is under the minimum.
 *
 * @param {string} essayText    - The student's answer text
 * @param {number} minWords     - Minimum required words (0 = no minimum)
 * @param {number} questionOrder - For the error message
 */
export const validateEssayMinWords = (essayText, minWords, questionOrder) => {
  if (!minWords || minWords <= 0) return; // No minimum configured

  if (!essayText || essayText.trim().length === 0) {
    throw ApiError.badRequest(
      `السؤال ${questionOrder}: يجب كتابة إجابة مقالية. الحد الأدنى ${minWords} كلمة`
    );
  }

  const wordCount = countWords(essayText);
  if (wordCount < minWords) {
    throw ApiError.badRequest(
      `السؤال ${questionOrder}: إجابتك تحتوي على ${wordCount} كلمة، والحد الأدنى المطلوب ${minWords} كلمة`
    );
  }
};
