/**
 * Valid weekday mappings (Arabic and English)
 */
export const WEEKDAYS_MAP = {
  0: { en: 'Sunday', ar: 'الأحد' },
  1: { en: 'Monday', ar: 'الإثنين' },
  2: { en: 'Tuesday', ar: 'الثلاثاء' },
  3: { en: 'Wednesday', ar: 'الأربعاء' },
  4: { en: 'Thursday', ar: 'الخميس' },
  5: { en: 'Friday', ar: 'الجمعة' },
  6: { en: 'Saturday', ar: 'السبت' },
};

export const VALID_ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

/**
 * Parses scheduleDays field from DB into a clean Array of strings.
 * Handles JSON string, comma-separated string, or already parsed array.
 *
 * @param {string|string[]} rawDays
 * @returns {string[]}
 */
export const parseScheduleDays = (rawDays) => {
  if (!rawDays) return [];

  if (Array.isArray(rawDays)) {
    return rawDays.map((d) => String(d).trim()).filter(Boolean);
  }

  if (typeof rawDays === 'string') {
    const trimmed = rawDays.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((d) => String(d).trim()).filter(Boolean);
        }
      } catch (_) {}
    }
    return trimmed
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  }

  return [];
};

/**
 * Formats schedule days for safe database storage.
 *
 * @param {string[]|string} days
 * @returns {string} Comma-separated or JSON string
 */
export const serializeScheduleDays = (days) => {
  const parsed = parseScheduleDays(days);
  return parsed.join(',');
};

/**
 * Checks if a group is scheduled on a given Date or day name.
 *
 * @param {string|string[]} scheduleDays
 * @param {Date|string} dateOrDayName - Date object or Arabic/English day name
 * @returns {boolean}
 */
export const isGroupScheduledOn = (scheduleDays, dateOrDayName = new Date()) => {
  const days = parseScheduleDays(scheduleDays);
  if (!days.length) return false;

  let targetArabicDay = '';

  if (dateOrDayName instanceof Date) {
    const dayIndex = dateOrDayName.getDay(); // 0 = Sunday, 1 = Monday...
    targetArabicDay = WEEKDAYS_MAP[dayIndex]?.ar || '';
  } else if (typeof dateOrDayName === 'string') {
    targetArabicDay = dateOrDayName.trim();
  }

  return days.some(
    (d) => d.toLowerCase() === targetArabicDay.toLowerCase() || targetArabicDay.includes(d)
  );
};
