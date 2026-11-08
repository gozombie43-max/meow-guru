/**
 * FINDING-06 regression: unsafe URL schemes / navigation targets.
 *
 * Verifies at the contract boundary (@meow/contracts/notifications), the API
 * boundary (POST /api/exam-updates) and the service boundary (publishExamUpdate)
 * that only same-origin internal routes and http(s) source URLs are accepted.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { signToken } from '../../auth/jwt.js';

vi.mock('../../auth/sessions.js', () => ({ assertSession: async decoded => decoded }));

const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockSendPushToAllUsers = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getExamUpdatesCollection: () => ({
    insertOne: (...args) => mockInsertOne(...args),
    updateOne: (...args) => mockUpdateOne(...args),
    find: vi.fn(() => ({ sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue([]) })),
    countDocuments: vi.fn().mockResolvedValue(0),
  }),
}));

vi.mock('../../services/pushNotificationService.js', () => ({
  sendPushToAllUsers: (...args) => mockSendPushToAllUsers(...args),
}));

const mockGetScheduledById = vi.fn();
const mockInsertScheduled = vi.fn();
vi.mock('../../repositories/notificationRepository.js', () => ({
  getScheduledNotificationById: (...args) => mockGetScheduledById(...args),
  insertScheduledNotification: (...args) => mockInsertScheduled(...args),
  setScheduledNotificationRetried: vi.fn().mockResolvedValue({}),
}));

import { retryScheduledNotification } from '../../controllers/notificationController.js';

import {
  broadcastSchema,
  scheduleSchema,
  isSafeInternalRoute,
  isSafeHttpUrl,
} from '@meow/contracts/notifications';
import { publishExamUpdate } from '../../services/examUpdateService.js';
import examUpdatesRouter from '../../routes/examUpdates.routes.js';

const UNSAFE_ROUTES = [
  '//evil.example.com',
  '//evil.example.com/path',
  'https://evil.example.com',
  'http://evil.example.com',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  '/\\evil.example.com',
  '/path"onmouseover="x',
  "/path'x",
  '/<script>',
  '/path with space',
  'relative/path',
  '',
  `/${'a'.repeat(600)}`,
];

const SAFE_ROUTES = ['/', '/mock-test', '/exam-updates/ssc-cgl', '/practice?set=1&lang=en', '/a/b#section'];

const UNSAFE_URLS = [
  'javascript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD4=',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'ftp://example.com/file',
  'not a url',
  '//evil.example.com',
];

const SAFE_URLS = ['https://ssc.gov.in', 'http://example.com/notice.pdf', 'https://ssc.gov.in/a?b=c#d'];

const base = { title: 'T', body: 'B' };
const future = () => new Date(Date.now() + 3_600_000).toISOString();

describe('FINDING-06: contract boundary', () => {
  it.each(UNSAFE_ROUTES)('broadcast/schedule reject unsafe route %j', (route) => {
    expect(broadcastSchema.safeParse({ ...base, route }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, route, sendAt: future() }).success).toBe(false);
    expect(isSafeInternalRoute(route)).toBe(false);
  });

  it.each(SAFE_ROUTES)('broadcast/schedule accept safe route %j', (route) => {
    expect(broadcastSchema.safeParse({ ...base, route }).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...base, route, sendAt: future() }).success).toBe(true);
  });

  it('keeps default route "/" when omitted', () => {
    expect(broadcastSchema.parse(base).route).toBe('/');
  });

  it.each(UNSAFE_URLS)('isSafeHttpUrl rejects %j', (url) => {
    expect(isSafeHttpUrl(url)).toBe(false);
  });

  it.each(SAFE_URLS)('isSafeHttpUrl accepts %j', (url) => {
    expect(isSafeHttpUrl(url)).toBe(true);
  });
});

describe('FINDING-06: API boundary (POST /api/exam-updates)', () => {
  let server;
  let baseUrl;
  const adminToken = signToken({ id: 'admin-1', email: 'admin@quizguru.com', role: 'admin' });
  const payload = { examSlug: 'ssc-cgl', type: 'result', title: 'Result out', message: 'Check now.' };

  const post = body => fetch(`${baseUrl}/api/exam-updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/exam-updates', examUpdatesRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertOne.mockResolvedValue({ insertedId: 'x' });
    mockUpdateOne.mockResolvedValue({});
    mockSendPushToAllUsers.mockResolvedValue({ totalDevices: 0, successCount: 0, failureCount: 0 });
  });

  it.each(UNSAFE_URLS)('rejects sourceUrl %j with 400 and publishes nothing', async (sourceUrl) => {
    const res = await post({ ...payload, sourceUrl });
    expect(res.status).toBe(400);
    expect(mockInsertOne).not.toHaveBeenCalled();
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it.each(UNSAFE_ROUTES.filter(r => r !== ''))('rejects route %j with 400 and publishes nothing', async (route) => {
    const res = await post({ ...payload, route });
    expect(res.status).toBe(400);
    expect(mockInsertOne).not.toHaveBeenCalled();
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it('accepts safe route and https sourceUrl', async () => {
    const res = await post({ ...payload, route: '/exam-updates/ssc-cgl', sourceUrl: 'https://ssc.gov.in' });
    expect(res.status).toBe(200);
    expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({ route: '/exam-updates/ssc-cgl', sourceUrl: 'https://ssc.gov.in' }));
  });

  it('accepts null sourceUrl and omitted route', async () => {
    const res = await post({ ...payload, sourceUrl: null });
    expect(res.status).toBe(200);
    expect(mockSendPushToAllUsers).toHaveBeenCalledWith(expect.objectContaining({ route: '/exam-updates/ssc-cgl' }));
  });
});

describe('FINDING-06: service boundary (publishExamUpdate defense-in-depth)', () => {
  const input = { examSlug: 'ssc-cgl', type: 'result', title: 'T', message: 'M' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertOne.mockResolvedValue({ insertedId: 'x' });
    mockUpdateOne.mockResolvedValue({});
    mockSendPushToAllUsers.mockResolvedValue({ totalDevices: 0, successCount: 0, failureCount: 0 });
  });

  it('throws 400 for unsafe route without persisting or pushing', async () => {
    await expect(publishExamUpdate({ ...input, route: 'javascript:alert(1)' })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockInsertOne).not.toHaveBeenCalled();
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it('throws 400 for unsafe sourceUrl without persisting or pushing', async () => {
    await expect(publishExamUpdate({ ...input, sourceUrl: 'data:text/html,x' })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it('URL-encodes examSlug in the default route so it cannot escape the path', async () => {
    await publishExamUpdate({ ...input, examSlug: '../x"<y>' });
    const route = mockInsertOne.mock.calls[0][0].route;
    expect(route.startsWith('/exam-updates/')).toBe(true);
    expect(isSafeInternalRoute(route)).toBe(true);
  });
});

describe('FINDING-06: retry of legacy scheduled notifications', () => {
  const run = async (route) => {
    mockGetScheduledById.mockResolvedValueOnce({ _id: '507f1f77bcf86cd799439011', title: 'T', body: 'B', route, status: 'failed' });
    mockInsertScheduled.mockResolvedValueOnce({ insertedId: 'new' });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await retryScheduledNotification({ params: { id: '507f1f77bcf86cd799439011' }, body: {}, user: { id: 'a', email: 'a@x' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    return mockInsertScheduled.mock.calls.at(-1)[0].route;
  };

  it.each(['javascript:alert(1)', '//evil.example.com', 'https://evil.example.com'])('downgrades stored unsafe route %j to "/"', async (route) => {
    expect(await run(route)).toBe('/');
  });

  it('preserves a stored safe route', async () => {
    expect(await run('/exam')).toBe('/exam');
  });
});
