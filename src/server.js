import app from './app.js';
import { ENV } from './config/env.config.js';
import prisma from './config/prisma.js';

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();

    app.listen(ENV.PORT, () => {
      console.log(' EUREKA LMS BACKEND SERVER STARTED SUCCESSFULLY');
      console.log(` Server URL        : http://localhost:${ENV.PORT}`);
      console.log(` Swagger API Docs  : http://localhost:${ENV.PORT}/api-docs`);
      console.log(` API Base Route    : http://localhost:${ENV.PORT}/api/v1`);
      console.log(` Health Check      : http://localhost:${ENV.PORT}/health`);
      console.log(` Database          : Connected (MySQL via Prisma)`);
    });
  } catch (error) {
    console.error('[Database Connection Error]:', error.message);
    app.listen(ENV.PORT, () => {
      console.log(` [Server Running in Offline DB Mode]: http://localhost:${ENV.PORT}`);
      console.log(` Swagger API Docs: http://localhost:${ENV.PORT}/api-docs`);
      console.log('========================================================\n');
    });
  }
}

startServer();
