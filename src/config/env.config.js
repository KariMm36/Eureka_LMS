import dotenv from 'dotenv';
dotenv.config();

// Guard: fail fast at startup if critical secrets are missing
if (!process.env.JWT_SECRET) {
  throw new Error('[Eureka] FATAL: JWT_SECRET must be set in .env — refusing to start with an insecure default');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('[Eureka] FATAL: JWT_REFRESH_SECRET must be set in .env');
}
if (!process.env.DATABASE_URL) {
  throw new Error('[Eureka] FATAL: DATABASE_URL must be set in .env');
}

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  OTP_EXPIRES_MINUTES: parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10),
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '2525', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@eureka-lms.com',
  DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL || 'admin@eureka.com',
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@SecurePass2026!',
  DEFAULT_ADMIN_PHONE: process.env.DEFAULT_ADMIN_PHONE || '01000000000',
};
