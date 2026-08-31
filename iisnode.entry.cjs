// IIS / iisnode entry point.
//
// iisnode's interceptor require()s this file, so it must be CommonJS: the app
// is an ESM package ("type": "module") and require() cannot load an ESM graph
// that uses top-level await.
//
// iisnode also launches node.exe with the working directory set to the entry
// script's folder. The app resolves several paths relative to the CWD --
// dotenv's `.env`, multer's `uploads/`, and FIREBASE_SERVICE_ACCOUNT_PATH --
// so pin the CWD to the application root before the app loads.
process.chdir(__dirname);

import('./src/server.js').catch((err) => {
  console.error('[iisnode.entry] Failed to start Eureka LMS server:', err);
  process.exit(1);
});
