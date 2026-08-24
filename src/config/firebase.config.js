import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { ENV } from './env.config.js';

let firebaseApp = null;
let isFirebaseInitialized = false;

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (serviceAccountPath && fs.existsSync(path.resolve(serviceAccountPath))) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(path.resolve(serviceAccountPath), 'utf8')
    );
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isFirebaseInitialized = true;
    console.log('[Firebase] Initialized with Service Account JSON file');
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    isFirebaseInitialized = true;
    console.log('[Firebase] Initialized with Environment Variables');
  } else {
    console.warn(
      '[Firebase] Service account credentials not provided. Push notifications will run in mock/log mode.'
    );
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Firebase Admin SDK:', error.message);
}

export const getFirebaseApp = () => firebaseApp;
export const isPushEnabled = () => isFirebaseInitialized;
export default admin;
