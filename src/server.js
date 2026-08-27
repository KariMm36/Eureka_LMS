import http from 'http';
import app from './app.js';
import { ENV } from './config/env.config.js';
import prisma from './config/prisma.js';
import { logger } from './config/logger.config.js';
import { initSocket, closeSocket } from './config/socket.config.js';

let serverInstance = null;
let isShuttingDown = false;

export const gracefulShutdown = async (signal, server = serverInstance) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[Shutdown] Received signal: ${signal}. Commencing graceful shutdown...`);

  // Force exit after 10s if in-flight requests hang
  const shutdownTimeout = setTimeout(() => {
    logger.error('[Shutdown] Forced shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);
  shutdownTimeout.unref();

  try {
    // 1. Close Socket.IO real-time engine & adapter
    await closeSocket();
    logger.info('[Shutdown] Socket.IO engine closed cleanly.');

    // 2. Close HTTP Server
    if (server && server.listening) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          logger.info('[Shutdown] HTTP server closed cleanly. In-flight connections finished.');
          resolve();
        });
      });
    }

    // 3. Disconnect Prisma
    await prisma.$disconnect();
    logger.info('[Shutdown] Prisma database connection closed.');

    clearTimeout(shutdownTimeout);
    logger.info('[Shutdown] Graceful cleanup finished successfully.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  } catch (err) {
    logger.error({ err }, `[Shutdown Error] Failed during graceful shutdown: ${err.message}`);
    clearTimeout(shutdownTimeout);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

async function startServer() {
  const httpServer = http.createServer(app);

  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully (MySQL via Prisma)');

    // Initialize Socket.IO on the same HTTP server
    await initSocket(httpServer);
    logger.info('[Socket.IO] Real-time engine attached to HTTP server');

    serverInstance = httpServer.listen(ENV.PORT, () => {
      logger.info({
        port: ENV.PORT,
        env: ENV.NODE_ENV,
        swaggerUrl: `http://localhost:${ENV.PORT}/api-docs`,
        apiBase: `http://localhost:${ENV.PORT}/api/v1`,
        health: `http://localhost:${ENV.PORT}/health`,
        readiness: `http://localhost:${ENV.PORT}/health/readiness`,
      }, `Eureka LMS Server running on port ${ENV.PORT}`);
    });
  } catch (error) {
    logger.error({ err: error }, `[Server Startup Error]: ${error.message}`);
    serverInstance = httpServer.listen(ENV.PORT, () => {
      logger.warn(`[Server Running in Offline Mode]: http://localhost:${ENV.PORT}`);
    });
  }
}

// Signal Listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, `[Unhandled Rejection]: ${reason?.message || reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, `[Uncaught Exception]: ${err.message}`);
  gracefulShutdown('uncaughtException');
});

startServer();

