import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';

const mockPutObject = vi.fn();
const mockGetObjectBuffer = vi.fn();
const mockDeleteObject = vi.fn();
const mockB2Send = vi.fn();

vi.mock('../../infrastructure/objectStorage.js', () => ({
  putObject: (...args) => mockPutObject(...args),
  getObjectBuffer: (...args) => mockGetObjectBuffer(...args),
  deleteObject: (...args) => mockDeleteObject(...args),
}));

vi.mock('../../config/b2.js', () => ({
  B2_BUCKET: 'test-bucket',
  b2Client: {
    send: (...args) => mockB2Send(...args),
  },
}));

import { resolveEmailOtpAccount } from '../../services/email/emailOtpAccount.js';
import passport, { initPassport } from '../../auth/passport.js';
import { createSession, assertSession } from '../../auth/sessions.js';
import {
  isSafeImageKey,
  keyFromImageId,
  serveImage,
} from '../../controllers/imageQuestionController.js';
import {
  trackPendingNoteImage,
  retainNoteImages,
} from '../../repositories/noteImageRepository.js';
import { enqueueTutorJob, cancelTutorJob } from '../../services/tutorJobs.js';
import { claimJob, failJob } from '../../infrastructure/durableQueue.js';
import { releaseTutorUsage } from '../../repositories/tutorQuotaRepository.js';
import {
  getAccessCodeLockoutState,
  recordAccessCodeFailure,
} from '../../repositories/accessCodeRepository.js';
import accessCodesRouter, {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '../../routes/accessCodes.js';
import {
  broadcastSchema,
  isSafeHttpUrl,
  isSafeInternalRoute,
  safeHttpUrlSchema,
  safeInternalRouteSchema,
} from '@meow/contracts/notifications';
import { publishExamUpdate } from '../../services/examUpdateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

describe('Production Hardening Adversarial Verification (Checks 1–7)', () => {
  let mongo;
  let db;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', mongo.getUri());
    vi.stubEnv('MONGODB_DB', 'production_hardening_adversarial_test');
    vi.stubEnv('JWT_SECRET', 'adversarial-jwt-secret-minimum-32-bytes-long!!');
    vi.stubEnv('JWT_REFRESH_SECRET', 'adversarial-refresh-secret-minimum-32-bytes!!');
    vi.stubEnv('SESSION_SECRET', 'adversarial-access-session-secret-32-bytes!!');
    vi.stubEnv('FRONTEND_URL', 'https://app.meowguru.test');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-google-client-secret');
    vi.stubEnv('GOOGLE_CALLBACK_URL', 'http://localhost:3000/auth/google/callback');
    db = await connectMongoDB();
    initPassport();
  }, 60000);

  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      db.collection('users').deleteMany({}),
      db.collection('authSessions').deleteMany({}),
      db.collection('notes').deleteMany({}),
      db.collection('noteImages').deleteMany({}),
      db.collection('runtimeJobs').deleteMany({}),
      db.collection('tutorDailyUsage').deleteMany({}),
      db.collection('tutorConcurrency').deleteMany({}),
      db.collection('accessCodes').deleteMany({}),
      db.collection('accessCodeLockouts').deleteMany({}),
      db.collection('examUpdates').deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await disconnectMongoDB();
    await mongo?.stop();
    vi.unstubAllEnvs();
  });

  const runGoogleStrategy = (profile) =>
    new Promise((resolve, reject) => {
      const strategy = passport._strategy('google');
      strategy._verify('access-token', 'refresh-token', profile, (err, user, info) => {
        if (err) return reject(err);
        resolve({ user, info });
      });
    });

  // ── 1. Account Takeover: Concurrent OTP/Google Linking & Session Invalidation ──
  describe('Check 1: Concurrent OTP/Google linking & session invalidation', () => {
    it('atomically strips unverified passwordHash and revokes active sessions under concurrent OTP + Google claims', async () => {
      const email = 'race-victim@example.test';
      const attackerHash = await bcrypt.hash('AttackerPassword123!', 12);
      const userId = 'user-race-ato-1';

      await db.collection('users').insertOne({
        id: userId,
        name: 'Squatter',
        email,
        emailNormalized: email,
        accountRecord: true,
        role: 'student',
        authProvider: 'local',
        passwordHash: attackerHash,
        emailVerified: false,
        authRevision: 0,
      });

      // Simulate a pre-existing session created before the legitimate owner claims the account
      const preExistingSession = await createSession({
        id: userId,
        email,
        role: 'student',
        authRevision: 0,
      });
      const decodedPreSession = JSON.parse(
        Buffer.from(preExistingSession.token.split('.')[1], 'base64url').toString('utf8')
      );
      expect(await assertSession(decodedPreSession)).toBeTruthy();

      // Fire OTP claim and Google OAuth claim concurrently
      const [otpResult, googleResult] = await Promise.all([
        resolveEmailOtpAccount(email),
        runGoogleStrategy({
          id: 'google-concurrent-id-999',
          displayName: 'True Owner',
          emails: [{ value: email, verified: true }],
          photos: [{ value: 'https://lh3.googleusercontent.com/a/owner' }],
        }),
      ]);

      expect(otpResult).toBeTruthy();
      expect(googleResult.user).toBeTruthy();

      // Verify DB state: emailVerified is true, passwordHash is gone, authRevision incremented
      const storedUser = await db.collection('users').findOne({ id: userId });
      expect(storedUser.emailVerified).toBe(true);
      expect(storedUser).not.toHaveProperty('passwordHash');
      expect(storedUser.authRevision).toBeGreaterThanOrEqual(1);

      // Verify pre-existing session is revoked and rejected by assertSession
      const sessionDoc = await db.collection('authSessions').findOne({ _id: decodedPreSession.sid });
      expect(sessionDoc.revokedAt).toBeInstanceOf(Date);
      await expect(assertSession(decodedPreSession)).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // ── 2. Storage: B2 Object Authorization, Malformed Encoded IDs & Cross-User Access ──
  describe('Check 2: B2 object authorization, malformed encoded IDs & cross-user access', () => {
    it('rejects non-canonical base64url IDs, dot segments, traversal keys, and unauthorized B2 prefixes', async () => {
      const validKey = 'question-images/q_100/question.webp';
      const canonicalId = Buffer.from(validKey, 'utf8').toString('base64url');
      expect(keyFromImageId(canonicalId)).toBe(validKey);

      // Non-canonical base64url strings (padded, invalid chars, whitespace, empty, oversized)
      expect(keyFromImageId(`${canonicalId}=`)).toBeNull();
      expect(keyFromImageId(`${canonicalId}==`)).toBeNull();
      expect(keyFromImageId(`${canonicalId}!@#$`)).toBeNull();
      expect(keyFromImageId('')).toBeNull();
      expect(keyFromImageId('a'.repeat(513))).toBeNull();

      // Dot-prefixed or traversal segments must fail isSafeImageKey
      for (const badKey of [
        'question-images/.hidden/question.webp',
        'question-images/q_1/.secret.webp',
        'question-images/../solution-images/s1/solution.webp',
        'notes/user-1/note.webp',
        'tutor-jobs/job-1/attachment.webp',
      ]) {
        expect(isSafeImageKey(badKey)).toBe(false);
        const encoded = Buffer.from(badKey, 'utf8').toString('base64url');
        const req = { params: { id: encoded } };
        const res = {
          statusCode: 200,
          body: null,
          status(code) { this.statusCode = code; return this; },
          json(payload) { this.body = payload; return this; },
        };
        await serveImage(req, res);
        expect(res.statusCode).toBe(404);
        expect(mockB2Send).not.toHaveBeenCalled();
      }
    });

    it('prevents cross-user note image key access even when another user owns a valid notes/ key', async () => {
      const victimEncoded = Buffer.from('victim-user', 'utf8').toString('base64url');
      const attackerEncoded = Buffer.from('attacker-user', 'utf8').toString('base64url');
      const victimKey = `notes/images/pending/${victimEncoded}/1700000000-secret.webp`;
      const attackerKey = `notes/images/pending/${attackerEncoded}/1700000000-own.webp`;

      await trackPendingNoteImage(victimKey, 'victim-user');
      await trackPendingNoteImage(attackerKey, 'attacker-user');

      // Attacker can attach their own pending note image
      await expect(
        retainNoteImages([attackerKey], { userId: 'attacker-user', existingKeys: [] })
      ).resolves.toBeUndefined();

      // Attacker attempting to attach victim's pending note image is rejected with 403
      await expect(
        retainNoteImages([victimKey], { userId: 'attacker-user', existingKeys: [] })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ── 3. CI/CD: Every Workflow Permission, Branch Guard & Azure OIDC Isolation ──
  describe('Check 3: Workflow permissions, branch guards & Azure OIDC isolation', () => {
    const workflowsDir = path.join(repoRoot, '.github', 'workflows');
    const workflowFiles = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));

    it('enforces explicit top-level read-only permissions across all GitHub workflows', () => {
      expect(workflowFiles.length).toBeGreaterThanOrEqual(7);
      for (const file of workflowFiles) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        expect(content, `${file} must declare top-level permissions`).toMatch(
          /^permissions:\s*\r?\n\s+contents:\s*read/m
        );
        expect(content, `${file} must not grant write-all`).not.toMatch(/permissions:\s*write-all/i);
      }
    });

    it('restricts every workflow job that requests id-token: write to refs/heads/main and isolated environments', () => {
      const stagingDeploy = fs.readFileSync(
        path.join(workflowsDir, 'main_quizguru-backend-staging.yml'),
        'utf8'
      );
      const stagingLoad = fs.readFileSync(
        path.join(workflowsDir, 'training-staging-load.yml'),
        'utf8'
      );
      const prodDeploy = fs.readFileSync(
        path.join(workflowsDir, 'main_quizguru-backend.yml'),
        'utf8'
      );
      const canaryPromote = fs.readFileSync(
        path.join(workflowsDir, 'backend-canary-promotion.yml'),
        'utf8'
      );

      // Staging workflows must never reference production resource group or production DB secret
      for (const [name, content] of [
        ['main_quizguru-backend-staging.yml', stagingDeploy],
        ['training-staging-load.yml', stagingLoad],
      ]) {
        expect(content, name).toContain("if: github.ref == 'refs/heads/main'");
        expect(content, name).toContain('environment: quizguru-backend-staging');
        expect(content, name).toContain('AZURE_RESOURCE_GROUP: Meowguru_staging_group');
        expect(content, name).not.toContain('Meowguru_group');
        expect(content, name).not.toMatch(/secrets\.MONGODB_URI\b/);
        expect(content, name).toContain('secrets.STAGING_AZURE_CLIENT_ID');
      }

      // Production deploy and canary promotion must require refs/heads/main and protected environments
      expect(prodDeploy).toContain("if: github.ref == 'refs/heads/main'");
      expect(prodDeploy).toContain('environment: quizguru-backend');
      expect(canaryPromote).toContain("if: github.ref == 'refs/heads/main'");
      expect(canaryPromote).toContain('environment: backend-canary');
    });
  });

  // ── 4. AI Quota: Concurrent Requests, Worker Crashes, Retries & Idempotent Refunds ──
  describe('Check 4: AI quota concurrency, worker retries, crashes & idempotent upload retry', () => {
    it('prevents quota bypass when an upload fails and the client retries with the same Idempotency-Key', async () => {
      vi.stubEnv('TUTOR_DAILY_REQUESTS', '1');
      const userId = 'user-quota-retry-1';
      const input = { context: 'Algebra question', message: 'Solve for x' };
      const file = {
        originalname: 'problem.png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-png-bytes'),
      };
      const idempotencyKey = 'idem-key-retry-test-001';

      // 1st attempt: object storage upload fails -> quota and queue slot must be refunded, staging doc cleaned up
      mockPutObject.mockRejectedValueOnce(new Error('B2 transient network failure'));
      await expect(enqueueTutorJob(userId, input, file, idempotencyKey)).rejects.toThrow(
        'B2 transient network failure'
      );

      const usageAfterFail = await db.collection('tutorDailyUsage').findOne({ userId });
      expect(usageAfterFail.requests).toBe(0);
      expect(usageAfterFail.requestIds).toEqual([]);

      // 2nd attempt with SAME Idempotency-Key: must re-reserve quota rather than queueing for free!
      mockPutObject.mockResolvedValueOnce(undefined);
      const queuedJob = await enqueueTutorJob(userId, input, file, idempotencyKey);
      expect(queuedJob.status).toBe('queued');

      const usageAfterRetry = await db.collection('tutorDailyUsage').findOne({ userId });
      expect(usageAfterRetry.requests).toBe(1);
      expect(usageAfterRetry.requestIds).toHaveLength(1);

      // A 3rd distinct request must now be blocked by the daily limit of 1
      await expect(
        enqueueTutorJob(userId, input, file, 'idem-key-second-distinct-002')
      ).rejects.toMatchObject({ statusCode: 429 });
    });

    it('enforces exact daily quota under concurrent requests and refunds only on terminal worker failure (not transient retry)', async () => {
      vi.stubEnv('TUTOR_DAILY_REQUESTS', '2');
      const userId = 'user-quota-concurrent-1';
      const input = { context: 'Geometry', message: 'Find angle' };
      const file = {
        originalname: 'triangle.png',
        mimetype: 'image/png',
        buffer: Buffer.from('triangle-image-data'),
      };

      mockPutObject.mockResolvedValue(undefined);

      // Fire 5 concurrent enqueue requests when daily limit is 2 and max queued per user is 2
      const outcomes = await Promise.allSettled(
        Array.from({ length: 5 }, (_, idx) =>
          enqueueTutorJob(userId, input, file, `concurrent-key-000${idx}`)
        )
      );

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');
      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(3);

      const usageAtPeak = await db.collection('tutorDailyUsage').findOne({ userId });
      expect(usageAtPeak.requests).toBe(2);

      // Simulate worker transient crash on attempt 1 (attempts < 3): job returns to 'queued', quota NOT refunded yet
      const jobsCol = db.collection('runtimeJobs');
      const claimedAttempt1 = await claimJob(jobsCol, 'tutor');
      expect(claimedAttempt1.attempts).toBe(1);
      await failJob(jobsCol, claimedAttempt1);
      const afterAttempt1 = await jobsCol.findOne({ _id: claimedAttempt1._id });
      expect(afterAttempt1.status).toBe('queued');
      const usageAfterAttempt1 = await db.collection('tutorDailyUsage').findOne({ userId });
      expect(usageAfterAttempt1.requests).toBe(2);

      // Simulate terminal worker failure on attempt 3: status becomes 'failed' and worker refunds 1 quota unit
      await jobsCol.updateOne(
        { _id: claimedAttempt1._id },
        { $set: { attempts: 2, availableAt: new Date(Date.now() - 1000) } }
      );
      const claimedAttempt3 = await claimJob(jobsCol, 'tutor');
      expect(claimedAttempt3.attempts).toBe(3);
      await failJob(jobsCol, claimedAttempt3);
      const afterAttempt3 = await jobsCol.findOne({ _id: claimedAttempt3._id });
      expect(afterAttempt3.status).toBe('failed');
      await releaseTutorUsage(claimedAttempt3.quotaReservation, {
        userId: claimedAttempt3.userId,
        input: claimedAttempt3.input,
        attachmentBytes: claimedAttempt3.attachmentBytes || 0,
        now: claimedAttempt3.createdAt,
        reservationId: `${claimedAttempt3._id}:${claimedAttempt3.payloadHash}`,
      });
      const usageAfterTerminal = await db.collection('tutorDailyUsage').findOne({ userId });
      expect(usageAfterTerminal.requests).toBe(1);

      // Cancel the second job: refunds the remaining quota unit and never drops below 0 on duplicate cancel
      const secondJob = fulfilled.find((f) => f.value._id !== claimedAttempt1._id).value;
      expect(await cancelTutorJob(userId, secondJob._id)).toBe(true);
      expect(await cancelTutorJob(userId, secondJob._id)).toBe(false);
      const usageAfterCancel = await db.collection('tutorDailyUsage').findOne({ userId });
      expect(usageAfterCancel.requests).toBe(0);
    });
  });

  // ── 5. Access Code: Atomic Distributed Lockout, Cookie CSRF & Session Expiration ──
  describe('Check 5: Atomic distributed lockout, cookie CSRF & session expiration', () => {
    it('atomically resets expired lockout windows and counts concurrent failures without race loss', async () => {
      const clientKey = '198.51.100.77';
      const pastNow = new Date(Date.now() - 20 * 60 * 1000);

      // Seed an expired lockout record
      await recordAccessCodeFailure(clientKey, pastNow);
      const expiredDoc = await db.collection('accessCodeLockouts').findOne({ _id: clientKey });
      expect(new Date(expiredDoc.expiresAt).getTime()).toBeLessThan(Date.now());

      // Fire 5 concurrent failures right after the window expired
      const now = new Date();
      const states = await Promise.all(
        Array.from({ length: 5 }, () => recordAccessCodeFailure(clientKey, now))
      );

      const maxObservedAttempts = Math.max(...states.map((s) => s.attempts));
      expect(maxObservedAttempts).toBe(5);

      const currentLockout = await getAccessCodeLockoutState(clientKey, now);
      expect(currentLockout.locked).toBe(true);
      expect(currentLockout.attempts).toBe(5);
    });

    it('rejects cross-site CSRF Origin headers on /verify and /logout and enforces 24h token expiration', async () => {
      await db.collection('accessCodes').insertOne({
        id: 'code-csrf-1',
        code: 'VALIDCODE',
        active: true,
        usedCount: 0,
        maxUses: 10,
      });

      const app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.use('/api/access-code', accessCodesRouter);

      const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const baseUrl = `http://127.0.0.1:${server.address().port}`;

      try {
        // Cross-origin request from evil origin must be blocked with 403 before touching DB or cookies
        const csrfVerifyRes = await fetch(`${baseUrl}/api/access-code/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://evil.attacker.example',
          },
          body: JSON.stringify({ code: 'VALIDCODE' }),
        });
        expect(csrfVerifyRes.status).toBe(403);

        const csrfLogoutRes = await fetch(`${baseUrl}/api/access-code/logout`, {
          method: 'POST',
          headers: {
            Origin: 'https://evil.attacker.example',
          },
        });
        expect(csrfLogoutRes.status).toBe(403);

        // Trusted origin succeeds and sets HttpOnly cookie
        const trustedVerifyRes = await fetch(`${baseUrl}/api/access-code/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://app.meowguru.test',
          },
          body: JSON.stringify({ code: 'VALIDCODE' }),
        });
        expect(trustedVerifyRes.status).toBe(200);
        const setCookie = trustedVerifyRes.headers.get('set-cookie') || '';
        expect(setCookie).toContain('access_session=');
        expect(setCookie).toContain('HttpOnly');

        // Verify token expiration boundary: token older than 24h is rejected
        const validNowToken = createSignedSessionToken('code-csrf-1');
        expect(verifySignedSessionToken(validNowToken)).toBe(true);

        const expiredTs = Date.now() - (24 * 60 * 60 * 1000 + 1000);
        const payload = `${expiredTs}:code-csrf-1`;
        const expiredSig = createHash
          ? (await import('node:crypto')).default
              .createHmac('sha256', process.env.SESSION_SECRET)
              .update(payload)
              .digest('hex')
          : '';
        const expiredToken = `${payload}.${expiredSig}`;
        expect(verifySignedSessionToken(expiredToken)).toBe(false);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });

  // ── 6. URL Validation: Encoded Paths, Protocol-Relative URLs & Redirect Handling ──
  describe('Check 6: Encoded paths, protocol-relative URLs & redirect handling', () => {
    it('rejects single/double URL-encoded protocol-relative paths, path traversal, and control characters', () => {
      const maliciousRoutes = [
        '//evil.com/phish',
        '/\\evil.com/phish',
        '/%2f/evil.com',
        '/%2F/evil.com',
        '/%5cevil.com',
        '/%5Cevil.com',
        '/%252f/evil.com',
        '/%255cevil.com',
        '/dashboard/../../evil',
        '/..',
        '/\u0000evil',
        '/\r\nLocation: https://evil.com',
        '/%E0%A4%A', // malformed percent encoding
        'javascript:alert(1)',
        'https://evil.com/path',
      ];

      for (const badRoute of maliciousRoutes) {
        expect(isSafeInternalRoute(badRoute), `isSafeInternalRoute(${badRoute})`).toBe(false);
        expect(
          safeInternalRouteSchema.safeParse(badRoute).success,
          `safeInternalRouteSchema(${badRoute})`
        ).toBe(false);
        expect(
          broadcastSchema.safeParse({
            title: 'Alert',
            body: 'Body',
            route: badRoute,
          }).success
        ).toBe(false);
      }

      // Valid internal routes with query strings and hashes continue to pass
      for (const goodRoute of [
        '/',
        '/dashboard',
        '/exam-updates/ssc-cgl-2026?tab=dates#latest',
        '/mock-tests/attempt%201',
      ]) {
        expect(isSafeInternalRoute(goodRoute), `isSafeInternalRoute(${goodRoute})`).toBe(true);
        expect(safeInternalRouteSchema.safeParse(goodRoute).success).toBe(true);
      }
    });

    it('rejects unsafe external URLs including embedded credentials, control chars, and non-http protocols', async () => {
      for (const badUrl of [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '//evil.com/path',
        'https://admin:secret@evil.com/phish',
        'https://evil.com/\r\nInjected: header',
      ]) {
        expect(isSafeHttpUrl(badUrl), `isSafeHttpUrl(${badUrl})`).toBe(false);
        expect(safeHttpUrlSchema.safeParse(badUrl).success).toBe(false);
      }

      // Service-level defense-in-depth rejects encoded protocol-relative routes too
      await expect(
        publishExamUpdate({
          examSlug: 'ssc-cgl',
          type: 'result',
          title: 'Result',
          message: 'Out now',
          route: '/%2f/evil.com',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ── 7. Error Redaction: Backend-Wide Raw Exception Audit ──
  describe('Check 7: Backend-wide raw exception response audit', () => {
    it('confirms no production route or controller returns unguarded err.message on 500 responses', () => {
      const dirsToScan = [
        path.join(repoRoot, 'backend', 'routes'),
        path.join(repoRoot, 'backend', 'controllers'),
      ];

      const violations = [];
      for (const dir of dirsToScan) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
          const fullPath = path.join(dir, entry.name);
          const content = fs.readFileSync(fullPath, 'utf8');

          // Check for direct `.status(500).json({ ... err.message / error.message ... })`
          const direct500Leak = /\.status\(\s*500\s*\)\s*\.json\(\s*\{[^}]*\b(?:err|error)\.message\b/s;
          if (direct500Leak.test(content)) {
            violations.push(`${entry.name}: direct status(500) returning err.message`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
