import admin, { isPushEnabled } from '../config/firebase.config.js';
import prisma from '../config/prisma.js';

/**
 * Send a push notification to a specific user by their userId.
 * Looks up user's FCM token in the DB and dispatches via Firebase Messaging.
 * Cleans up invalid/expired tokens automatically if Firebase rejects them.
 *
 * @param {Object} options
 * @param {string} options.userId - Target user's ID
 * @param {string} options.title  - Notification title
 * @param {string} options.body   - Notification body text
 * @param {Object} [options.data] - Optional string key-value payload
 */
export const sendPushNotification = async ({ userId, title, body, data = {} }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fcmToken: true },
    });

    if (!user || !user.fcmToken) {
      return { success: false, reason: 'No FCM token registered for this user' };
    }

    if (!isPushEnabled()) {
      console.log(`[Push Notification (Mock)] To User: ${userId} | Title: "${title}" | Body: "${body}"`);
      return { success: true, mocked: true };
    }

    // Convert data values to strings as required by FCM
    const stringifiedData = Object.entries(data).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {});

    const message = {
      token: user.fcmToken,
      notification: {
        title,
        body,
      },
      data: stringifiedData,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'eureka_default_channel',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`[Push Notification] Failed to send push to user ${userId}:`, error.message);

    // If token is invalid or unregistered, clean it up from DB
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      await prisma.user
        .update({
          where: { id: userId },
          data: { fcmToken: null },
        })
        .catch(() => {});
      console.log(`[Push Notification] Removed invalid FCM token for user ${userId}`);
    }

    return { success: false, error: error.message };
  }
};

/**
 * Send push notifications to multiple FCM tokens in batch/multicast.
 * Splits tokens into bounded chunks of maximum 500 tokens (FCM hard limit)
 * and processes with bounded concurrency to prevent socket starvation.
 *
 * @param {Object} options
 * @param {string[]} options.tokens - Array of FCM registration tokens
 * @param {string} options.title    - Notification title
 * @param {string} options.body     - Notification body text
 * @param {Object} [options.data]   - Optional string key-value payload
 */
export const sendPushNotificationToTokens = async ({ tokens = [], title, body, data = {} }) => {
  if (!tokens || !tokens.length) return { success: false, count: 0, successCount: 0, failureCount: 0 };

  const FCM_MAX_CHUNK_SIZE = 500;
  const CONCURRENCY_LIMIT = 5;

  if (!isPushEnabled()) {
    console.log(`[Push Multicast (Mock)] Tokens: ${tokens.length} (Chunks: ${Math.ceil(tokens.length / FCM_MAX_CHUNK_SIZE)}) | Title: "${title}"`);
    return {
      success: true,
      mocked: true,
      count: tokens.length,
      successCount: tokens.length,
      failureCount: 0,
      totalChunks: Math.ceil(tokens.length / FCM_MAX_CHUNK_SIZE),
    };
  }

  const stringifiedData = Object.entries(data).reduce((acc, [k, v]) => {
    acc[k] = String(v);
    return acc;
  }, {});

  // 1. Split tokens into chunks of max 500
  const chunks = [];
  for (let i = 0; i < tokens.length; i += FCM_MAX_CHUNK_SIZE) {
    chunks.push(tokens.slice(i, i + FCM_MAX_CHUNK_SIZE));
  }

  let totalSuccessCount = 0;
  let totalFailureCount = 0;
  const errors = [];

  // 2. Process chunks in bounded batches (concurrency of 5)
  for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
    const activeBatch = chunks.slice(i, i + CONCURRENCY_LIMIT);
    const batchPromises = activeBatch.map(async (chunk) => {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data: stringifiedData,
        });
        return { success: true, successCount: response.successCount || 0, failureCount: response.failureCount || 0 };
      } catch (err) {
        console.error('[Push Multicast Chunk Error]:', err.message);
        return { success: false, error: err.message, successCount: 0, failureCount: chunk.length };
      }
    });

    const results = await Promise.all(batchPromises);
    for (const res of results) {
      totalSuccessCount += res.successCount;
      totalFailureCount += res.failureCount;
      if (!res.success && res.error) {
        errors.push(res.error);
      }
    }
  }

  return {
    success: totalFailureCount === 0 || totalSuccessCount > 0,
    successCount: totalSuccessCount,
    failureCount: totalFailureCount,
    totalChunks: chunks.length,
    ...(errors.length > 0 && { errors }),
  };
};
