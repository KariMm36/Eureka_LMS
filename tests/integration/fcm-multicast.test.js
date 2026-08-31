import { describe, it, expect } from 'vitest';
import { sendPushNotificationToTokens } from '../../src/utils/pushNotification.util.js';

describe('FCM Multicast Token Chunking & Bounded Concurrency', () => {
  it('1. should return count: 0 for empty tokens array', async () => {
    const res = await sendPushNotificationToTokens({
      tokens: [],
      title: 'اختبار الإشعار',
      body: 'نص تجريبي فارغ',
    });

    expect(res.success).toBe(false);
    expect(res.count).toBe(0);
    expect(res.successCount).toBe(0);
  });

  it('2. should handle single token (1 token -> exactly 1 chunk)', async () => {
    const res = await sendPushNotificationToTokens({
      tokens: ['dummy_token_1'],
      title: 'إشعار طالب منفرد',
      body: 'لديك واجب جديد',
    });

    expect(res.totalChunks).toBe(1);
    expect(res.successCount + res.failureCount).toBe(1);
  });

  it('3. should handle exact chunk boundary (500 tokens -> exactly 1 chunk)', async () => {
    const tokens = Array.from({ length: 500 }, (_, i) => `dummy_token_${i}`);
    const res = await sendPushNotificationToTokens({
      tokens,
      title: 'إشعار دفعة 500 طالب',
      body: 'بدء الحصة المباشرة',
    });

    expect(res.totalChunks).toBe(1);
    expect(res.successCount + res.failureCount).toBe(500);
  }, 30000);

  it('4. should split 501 tokens into exactly 2 chunks (500 + 1)', async () => {
    const tokens = Array.from({ length: 501 }, (_, i) => `dummy_token_${i}`);
    const res = await sendPushNotificationToTokens({
      tokens,
      title: 'إشعار 501 طالب',
      body: 'تنبيه موعد الامتحان',
    });

    expect(res.totalChunks).toBe(2);
    expect(res.successCount + res.failureCount).toBe(501);
  }, 30000);

  it('5. should split 1,200 tokens into exactly 3 chunks (500 + 500 + 200)', async () => {
    const tokens = Array.from({ length: 1200 }, (_, i) => `dummy_token_${i}`);
    const res = await sendPushNotificationToTokens({
      tokens,
      title: 'إعلان عام لجميع الطلاب',
      body: 'جدول المراجعة النهائية',
    });

    expect(res.totalChunks).toBe(3);
    expect(res.successCount + res.failureCount).toBe(1200);
  }, 30000);

  it('6. should split 2,500 tokens into exactly 5 chunks (500 each)', async () => {
    const tokens = Array.from({ length: 2500 }, (_, i) => `dummy_token_${i}`);
    const res = await sendPushNotificationToTokens({
      tokens,
      title: 'إعلان مرحلة الثانوية العامة',
      body: 'نتائج الاختبار الشامل',
    });

    expect(res.totalChunks).toBe(5);
    expect(res.successCount + res.failureCount).toBe(2500);
  }, 30000);
});
