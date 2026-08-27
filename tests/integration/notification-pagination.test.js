import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { TestSetupHelper } from '../helpers/testSetup.js';

describe('Notification Pagination & Bounds Test Suite', () => {
  const helper = new TestSetupHelper('notif_page_suite');
  let studentUser;

  beforeAll(async () => {
    await helper.cleanup();
    studentUser = await helper.createUser({ role: 'STUDENT', fullName: 'طالب ترقيم الإشعارات' });

    // Seed 25 test notifications for this student
    const notificationData = Array.from({ length: 25 }, (_, i) => ({
      userId: studentUser.user.id,
      title: `إشعار تجريبي #${i + 1}`,
      body: `محتوى تفصيلي للإشعار رقم ${i + 1}`,
      type: 'ANNOUNCEMENT',
      isRead: i < 5, // 5 read, 20 unread
      createdAt: new Date(Date.now() - (25 - i) * 60000), // Chronological timestamps
    }));

    await prisma.notification.createMany({ data: notificationData });
  });

  afterAll(async () => {
    await helper.cleanup();
    await prisma.$disconnect();
  });

  it('1. should fetch page 1 with default limit 20 and return pagination metadata', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${studentUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.totalCount).toBe(25);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.pageSize).toBe(20);
    expect(res.body.data.pagination.totalPages).toBe(2);
    expect(res.body.data.pagination.hasNextPage).toBe(true);
    expect(res.body.data.notifications.length).toBe(20);
    expect(res.body.data.unreadCount).toBe(20);
  });

  it('2. should fetch page 2 with remaining 5 notifications', async () => {
    const res = await request(app)
      .get('/api/v1/notifications?page=2&limit=20')
      .set('Authorization', `Bearer ${studentUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.page).toBe(2);
    expect(res.body.data.notifications.length).toBe(5);
    expect(res.body.data.pagination.hasNextPage).toBe(false);
  });

  it('3. should cap requested limit at 50 max (anti-DoS)', async () => {
    const res = await request(app)
      .get('/api/v1/notifications?limit=99999')
      .set('Authorization', `Bearer ${studentUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.pageSize).toBe(50);
  });

  it('4. should filter unread notifications with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/notifications?filter=unread&limit=10')
      .set('Authorization', `Bearer ${studentUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.totalCount).toBe(20);
    expect(res.body.data.notifications.length).toBe(10);
    expect(res.body.data.notifications.every((n) => n.isRead === false)).toBe(true);
  });
});
