import app from './app.js';
import { ENV } from './config/env.config.js';
import prisma from './config/prisma.js';
import { logger } from './config/logger.config.js';

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully (MySQL via Prisma)');

    app.listen(ENV.PORT, () => {
      logger.info({
        port: ENV.PORT,
        env: ENV.NODE_ENV,
        swaggerUrl: `http://localhost:${ENV.PORT}/api-docs`,
        apiBase: `http://localhost:${ENV.PORT}/api/v1`,
        health: `http://localhost:${ENV.PORT}/health`,
      }, `Eureka LMS Server running on port ${ENV.PORT}`);
    });
  } catch (error) {
    logger.error({ err: error }, `[Database Connection Error]: ${error.message}`);
    app.listen(ENV.PORT, () => {
      logger.warn(`[Server Running in Offline DB Mode]: http://localhost:${ENV.PORT}`);
    });
  }
}

startServer();

