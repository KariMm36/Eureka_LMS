import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';
import * as mailerConfig from '../../src/config/mailer.config.js';
import { errorHandler } from '../../src/middlewares/error.middleware.js';
import { ApiError } from '../../src/utils/apiError.js';

describe('Production Polish & Final Operational Hardening Suite', () => {
  const helper = new TestSetupHelper('polish_suite');
  let testUser;

  beforeAll(async () => {
    await helper.cleanup();
    testUser = await helper.createUser({ role: 'STUDENT' });
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Request Correlation ID
  // =========================================================================
  describe('1. Request Correlation ID Propagation', () => {
    it('1.1 should generate a UUID X-Request-Id if client provides none', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('1.2 should propagate and echo back a valid custom X-Request-Id', async () => {
      const customId = 'client-trace-id-998877';
      const res = await request(app)
        .get('/health')
        .set('X-Request-Id', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('1.3 should sanitize and replace an invalid/unsafe X-Request-Id with a new UUID', async () => {
      const maliciousId = 'invalid/path<script>alert(1)</script>';
      const res = await request(app)
        .get('/health')
        .set('X-Request-Id', maliciousId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).not.toBe(maliciousId);
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  // =========================================================================
  // 2. Health & Readiness Probes
  // =========================================================================
  describe('2. Health & Readiness Probes', () => {
    it('2.1 should verify lightweight liveness probe (/health) returns 200 OK', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });

    it('2.2 should verify database readiness probe (/health/readiness) returns 200 OK when DB is connected', async () => {
      const res = await request(app).get('/health/readiness');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.database).toBe('connected');
    });

    it('2.3 should return 503 Service Unavailable when database query fails without leaking SQL internals', async () => {
      const rawSpy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection pool exhausted: Can not connect to MySQL server on localhost:3306'));

      const res = await request(app).get('/health/readiness');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('unhealthy');
      expect(res.body.data.database).toBe('disconnected');
      expect(res.body.message).toContain('تعذر الاتصال بقاعدة البيانات');
      // Must NOT leak connection string or raw exception details
      expect(res.body.message).not.toContain('localhost:3306');

      rawSpy.mockRestore();
    });
  });

  // =========================================================================
  // 3. Production Error Sanitization
  // =========================================================================
  describe('3. Production Error Sanitization', () => {
    it('3.1 should sanitize raw unexpected 500 error in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const rawError = new Error('PrismaClientKnownRequestError: Table eureka_lms.internal_passwords does not exist');
      const req = { method: 'GET', originalUrl: '/api/v1/test', ip: '127.0.0.1', id: 'test-req-123' };
      const res = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };

      errorHandler(rawError, req, res, () => {});

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('حدث خطأ غير متوقع في الخادم');
      // No schema or table leak
      expect(res.body.message).not.toContain('eureka_lms');
      expect(res.body.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('3.2 should preserve intentional client-safe ApiError messages in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const safeError = ApiError.badRequest('كلمة المرور الحالية غير صحيحة');
      const req = { method: 'POST', originalUrl: '/api/v1/auth/change-password', id: 'test-req-456' };
      const res = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };

      errorHandler(safeError, req, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('كلمة المرور الحالية غير صحيحة');
      expect(res.body.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  // =========================================================================
  // 4. Password Reset SMTP Failure Resilience
  // =========================================================================
  describe('4. Password Reset SMTP Failure Resilience', () => {
    it('4.1 should return uniform 200 OK even when SMTP dispatch throws an unexpected error', async () => {
      const emailSpy = vi.spyOn(mailerConfig, 'sendEmail').mockRejectedValueOnce(new Error('SMTP connection timeout: connect ETIMEDOUT 74.125.133.108:465'));

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUser.user.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.user.email);
      // Response must NOT contain SMTP error details
      expect(res.text).not.toContain('ETIMEDOUT');

      emailSpy.mockRestore();
    });

    it('4.2 should return uniform 200 OK for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'ghost_unregistered_student@eureka-lms.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. Rate Limiter HTTP 429 Semantics
  // =========================================================================
  describe('5. Rate Limiter Status Code (HTTP 429)', () => {
    it('5.1 should verify ApiError.tooManyRequests returns statusCode 429', () => {
      const error = ApiError.tooManyRequests('تم تجاوز الحد المسموح');
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe('تم تجاوز الحد المسموح');
    });
  });
});
