import nodemailer from 'nodemailer';
import { ENV } from './env.config.js';

let transporter;

if (ENV.SMTP_USER && ENV.SMTP_PASS) {
  const isGmail = ENV.SMTP_HOST?.includes('gmail') || ENV.SMTP_USER?.includes('@gmail.com');

  transporter = nodemailer.createTransport(
    isGmail
      ? {
          service: 'gmail',
          auth: {
            user: ENV.SMTP_USER,
            pass: ENV.SMTP_PASS,
          },
        }
      : {
          host: ENV.SMTP_HOST,
          port: ENV.SMTP_PORT,
          secure: ENV.SMTP_PORT === 465, // true for 465, false for 587
          auth: {
            user: ENV.SMTP_USER,
            pass: ENV.SMTP_PASS,
          },
        }
  );
}

export const sendEmail = async ({ to, subject, html, text }) => {
  // If SMTP credentials not provided, log OTP to console for effortless development
  if (!transporter) {
    console.log('\n====================================');
    console.log(`📧 [EMAIL SIMULATION]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${text || html}`);
    console.log('====================================\n');
    return { messageId: 'simulated-id' };
  }

  return transporter.sendMail({
    from: `"Eureka LMS" <${ENV.EMAIL_FROM}>`,
    to,
    subject,
    text,
    html,
  });
};
