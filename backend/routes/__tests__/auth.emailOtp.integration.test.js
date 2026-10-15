import express from 'express';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { assertSession } from '../../auth/sessions.js';
import { verifyToken } from '../../auth/jwt.js';
import { hashEmailLoginCode, createEmailLoginOtp } from '../../services/email/emailLoginOtp.js';
import { issueEmailLoginChallenge } from '../../repositories/emailLoginOtpRepository.js';
import { up as createOtpIndexes } from '../../migrations/022-email-login-otp.js';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../firebaseAuth.routes.js', () => ({ default: express.Router() }));
vi.mock('../../auth/passport.js', () => ({ default: { authenticate: () => (_req, _res, next) => next() } }));
vi.mock('../../services/email/emailService.js', () => ({ sendEmail: mocks.send }));

let mongo, db, server, baseUrl;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'email_otp_route_tests');
  vi.stubEnv('REDIS_URL', '');
  vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
  db = await connectMongoDB();
  await db.collection('users').createIndex({ emailNormalized: 1 }, {
    name: 'account_email_identity', unique: true,
    partialFilterExpression: { accountRecord: true, emailNormalized: { $type: 'string' } },
  });
  await createOtpIndexes(db);
  const { initAuthRoutes } = await import('../auth.routes.js');
  const { initUserRoutes } = await import('../user.routes.js');
  const app = express(); app.use(express.json()); app.use('/auth', initAuthRoutes());
  app.use('/users', initUserRoutes());
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/auth/email-otp`;
}, 60000);
beforeEach(async () => {
  mocks.send.mockReset().mockResolvedValue({ id: 'test-mail' });
  await Promise.all(['users', 'authSessions', 'emailLoginChallenges', 'rateLimits'].map(name => db.collection(name).deleteMany({})));
});
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs();
});
const email = 'learner@example.test';
const post = (path, body, origin = 'http://localhost:3000') => fetch(`${baseUrl}/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
});
async function requestCode(address = email) {
  const response = await post('request', { email: address });
  expect(response.status).toBe(200);
  const body = await response.json();
  const code = mocks.send.mock.calls.at(-1)[0].text.match(/code: (\d{6})/)[1];
  return { email: address.trim().toLowerCase(), challengeId: body.challengeId, code };
}
async function insertUser(overrides = {}) {
  await db.collection('users').insertOne({ id: 'existing', name: 'Learner', email, emailNormalized: email,
    accountRecord: true, authProvider: 'local', emailVerified: true, role: 'student', ...overrides });
}

it('stores only a keyed hash and creates a verified account only after a successful code', async () => {
  const payload = await requestCode(' Learner@Example.test ');
  expect(await db.collection('users').countDocuments({})).toBe(0);
  const row = await db.collection('emailLoginChallenges').findOne({ _id: email });
  expect(payload.code).toMatch(/^\d{6}$/);
  expect(row.codeHash).toBe(hashEmailLoginCode(email, payload.challengeId, payload.code));
  expect(row).not.toHaveProperty('code');
  expect(row.attemptsRemaining).toBe(5);
  expect(row.expiresAt.getTime() - row.lastSentAt.getTime()).toBeLessThanOrEqual(300000);
  const response = await post('verify', { ...payload, role: 'superadmin' });
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('refreshToken=');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const result = await response.json();
  expect(result.user.role).toBe('student');
  await expect(assertSession(verifyToken(result.token))).resolves.toMatchObject({ id: result.user.id });
  const user = await db.collection('users').findOne({ id: result.user.id });
  expect(user.emailVerified).toBe(true);
  expect(user).not.toHaveProperty('passwordHash');
  expect(await db.collection('users').countDocuments({})).toBe(1);
  expect((await db.collection('emailLoginChallenges').findOne({ _id: email })).codeHash).toBeUndefined();
  expect((await post('verify', payload)).status).toBe(401);
});

it('signs an existing admin in without replacing their password or role', async () => {
  await insertUser({ role: 'admin', passwordHash: 'existing-password-hash' });
  const payload = await requestCode();
  const response = await post('verify', payload);
  expect(response.status).toBe(200);
  expect((await response.json()).user).toMatchObject({ id: 'existing', role: 'admin' });
  expect(await db.collection('users').countDocuments({})).toBe(1);
  expect((await db.collection('users').findOne({ id: 'existing' })).passwordHash).toBe('existing-password-hash');
});

it('confirms an unverified local address after OTP proof and removes the old verification token', async () => {
  await insertUser({ emailVerified: false, emailVerificationTokenHash: 'old-hash', emailVerificationExpiresAt: new Date() });
  const response = await post('verify', await requestCode());
  expect(response.status).toBe(200);
  const user = await db.collection('users').findOne({ id: 'existing' });
  expect(user.emailVerified).toBe(true);
  expect(user).not.toHaveProperty('emailVerificationTokenHash');
  expect(user).not.toHaveProperty('emailVerificationExpiresAt');
});

it.each(['suspended', 'banned'])('denies %s accounts without creating a replacement', async status => {
  await insertUser({ status });
  const response = await post('verify', await requestCode());
  expect(response.status).toBe(401);
  expect(await db.collection('authSessions').countDocuments({})).toBe(0);
  expect(await db.collection('users').countDocuments({})).toBe(1);
});

it('rejects an expired code before Mongo TTL cleanup', async () => {
  const payload = await requestCode();
  await db.collection('emailLoginChallenges').updateOne({ _id: email }, { $set: { expiresAt: new Date(0) } });
  expect((await post('verify', payload)).status).toBe(401);
  expect(await db.collection('users').countDocuments({})).toBe(0);
});

it('allows only one concurrent verification to create a session', async () => {
  const payload = await requestCode();
  const responses = await Promise.all([post('verify', payload), post('verify', payload)]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 401]);
  expect(await db.collection('authSessions').countDocuments({})).toBe(1);
  expect(await db.collection('users').countDocuments({})).toBe(1);
});

it('locks the challenge after five wrong guesses, including concurrent attempts', async () => {
  const payload = await requestCode();
  const wrong = { ...payload, code: payload.code === '000000' ? '999999' : '000000' };
  const responses = await Promise.all(Array.from({ length: 7 }, () => post('verify', wrong)));
  expect(responses.every(r => r.status === 401)).toBe(true);
  expect((await db.collection('emailLoginChallenges').findOne({ _id: email })).attemptsRemaining).toBe(0);
  expect((await post('verify', payload)).status).toBe(401);
  expect(await db.collection('authSessions').countDocuments({})).toBe(0);
});

it('enforces resend cooldown and invalidates the previous challenge after a new send', async () => {
  const original = await requestCode();
  const tooSoon = await post('request', { email });
  expect(tooSoon.status).toBe(429);
  expect(mocks.send).toHaveBeenCalledOnce();
  await db.collection('emailLoginChallenges').updateOne({ _id: email }, { $set: { lastSentAt: new Date(Date.now() - 61000) } });
  const replacement = await requestCode();
  expect(replacement.challengeId).not.toBe(original.challengeId);
  expect((await post('verify', original)).status).toBe(401);
  expect((await post('verify', replacement)).status).toBe(200);
});

it('limits a mailbox to five sends per hour even after successful sign-in', async () => {
  for (let i = 0; i < 5; i++) {
    if (i) await db.collection('emailLoginChallenges').updateOne({ _id: email }, { $set: { lastSentAt: new Date(Date.now() - 61000) } });
    const payload = await requestCode();
    if (i === 0) expect((await post('verify', payload)).status).toBe(200);
  }
  await db.collection('emailLoginChallenges').updateOne({ _id: email }, { $set: { lastSentAt: new Date(Date.now() - 61000) } });
  const limited = await post('request', { email });
  expect(limited.status).toBe(429);
  expect((await limited.json()).retryAfter).toBeGreaterThan(3500);
  expect(mocks.send).toHaveBeenCalledTimes(5);
});

it('grants one send under a concurrent resend race and resets the hourly window when due', async () => {
  const now = new Date();
  const challenge = createEmailLoginOtp(email, now);
  const attempts = await Promise.all(Array.from({ length: 4 }, () => issueEmailLoginChallenge({ email, ...challenge, now })));
  expect(attempts.filter(result => result.issued)).toHaveLength(1);
  const later = new Date(now.getTime() + 3600001);
  expect((await issueEmailLoginChallenge({ email, ...createEmailLoginOtp(email, later), now: later })).issued).toBe(true);
  expect((await db.collection('emailLoginChallenges').findOne({ _id: email })).requestCount).toBe(1);
});

it('invalidates a code on delivery failure without creating an account or exposing provider details', async () => {
  mocks.send.mockRejectedValue(new Error('provider error including private code'));
  const response = await post('request', { email });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Unable to send a code. Please try again later.' });
  const row = await db.collection('emailLoginChallenges').findOne({ _id: email });
  expect(row).not.toHaveProperty('codeHash');
  expect(await db.collection('users').countDocuments({})).toBe(0);
});

it('has the same request shape for existing/new mailboxes and protects both endpoints from untrusted origins', async () => {
  await insertUser();
  const existing = await post('request', { email });
  const fresh = await post('request', { email: 'new@example.test' });
  expect(existing.status).toBe(fresh.status);
  expect(Object.keys(await existing.json())).toEqual(Object.keys(await fresh.json()));
  expect((await post('request', { email }, 'https://evil.test')).status).toBe(403);
  expect((await post('verify', {}, 'https://evil.test')).status).toBe(403);
});

it('bounds request and verification traffic per IP using durable counters', async () => {
  await db.collection('rateLimits').insertOne({ _id: 'unused', totalHits: 0, resetTime: new Date() });
  // Every malformed request still consumes ingress quota, before body validation.
  const results = [];
  for (let i = 0; i < 16; i++) results.push((await post('request', {})).status);
  expect(results.slice(0, 15).every(status => status === 400)).toBe(true);
  expect(results[15]).toBe(429);
  const requestRow = await db.collection('rateLimits').findOne({ _id: /^email-otp-request:/ });
  expect(requestRow.totalHits).toBe(16);
});

it('only places TTL on disposable OTP challenges', async () => {
  const indexes = await db.collection('emailLoginChallenges').listIndexes().toArray();
  expect(indexes.find(index => index.name === 'email_login_challenge_cleanup')).toMatchObject({ key: { cleanupAt: 1 }, expireAfterSeconds: 0 });
  expect((await db.collection('users').listIndexes().toArray()).every(index => index.expireAfterSeconds === undefined)).toBe(true);
});

it.runIf(process.env.RUN_EMAIL_OTP_BROWSER === '1').each(['new', 'existing'])('completes browser OTP sign-in for a %s account through real routes and Mongo', async state => {
  const { chromium } = await import('playwright');
  if (state === 'existing') await insertUser({ role: 'admin' });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  const browserOrigin = process.env.OTP_BROWSER_URL || 'http://localhost:3000';
  const screenshots = process.env.OTP_SCREENSHOT_DIR || join(tmpdir(), 'meow-email-otp');
  try {
    await mkdir(screenshots, { recursive: true });
    await page.addInitScript(() => globalThis.localStorage.setItem('ui-theme', 'light'));
    await page.route('**/backend-api/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/backend-api', '');
      const response = await route.fetch({ url: `${new URL(baseUrl).origin}${path}` });
      await route.fulfill({ response });
    });
    await page.goto(`${browserOrigin}/login?next=/access-code`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Send code', exact: true }).waitFor();
    if (state === 'new' && process.env.OTP_SCREENSHOT_DIR) {
      await page.screenshot({ path: join(screenshots, 'otp-login-light-390.png') });
      await page.evaluate(() => {
        for (const element of [globalThis.document.documentElement, globalThis.document.body]) {
          element.classList.replace('theme-light', 'theme-dark'); element.dataset.theme = 'dark'; element.style.colorScheme = 'dark';
        }
      });
      await page.screenshot({ path: join(screenshots, 'otp-login-dark-390.png') });
      await page.evaluate(() => {
        for (const element of [globalThis.document.documentElement, globalThis.document.body]) {
          element.classList.replace('theme-dark', 'theme-light'); element.dataset.theme = 'light'; element.style.colorScheme = 'light';
        }
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: join(screenshots, 'otp-login-light-1280.png') });
      await page.setViewportSize({ width: 320, height: 740 });
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Send code', exact: true }).click();
    await page.getByLabel('6-digit code', { exact: true }).waitFor();
    const code = mocks.send.mock.calls.at(-1)[0].text.match(/code: (\d{6})/)[1];
    if (state === 'new' && process.env.OTP_SCREENSHOT_DIR) await page.screenshot({ path: join(screenshots, 'otp-login-code-390.png') });
    await page.getByLabel('6-digit code', { exact: true }).fill(code);
    const verified = page.waitForResponse(response => response.url().includes('/email-otp/verify'));
    const profile = page.waitForResponse(response => response.url().includes('/users/me'));
    await page.getByRole('button', { name: 'Verify & sign in', exact: true }).click();
    expect((await verified).status()).toBe(200);
    expect((await profile).status()).toBe(200);
    await page.waitForURL('**/access-code');
    expect((await page.context().cookies()).some(cookie => cookie.name === 'refreshToken' && cookie.httpOnly)).toBe(true);
    const user = await db.collection('users').findOne({ emailNormalized: email });
    expect(user.emailVerified).toBe(true);
    expect(user.role).toBe(state === 'existing' ? 'admin' : 'student');
    expect(await db.collection('authSessions').countDocuments({ userId: user.id })).toBe(1);
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await browser.close();
  }
}, 90000);
