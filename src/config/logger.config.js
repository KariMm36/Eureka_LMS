import pino from 'pino';
import { ENV } from './env.config.js';

const isProduction = ENV.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: isProduction
    ? {
        app: 'eureka-lms-backend',
        env: ENV.NODE_ENV,
      }
    : undefined,
});

export default logger;
