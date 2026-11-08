import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import cookieParser from 'cookie-parser';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import accessCodeRoutes from '../../routes/accessCodes.js';

function createInstanceApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(['/api/access-code', '/api/access-codes'], accessCodeRoutes);
  return app;
}

describe('FINDING-05 Regression: Multi-Instance Access-Code Lockout & HttpOnly Cookie Hardening', () => {
  let mongo;
  let db;
  let serverA;
  let serverB;
  let baseUrlA;
  let baseUrlB;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', mongo.getUri());
    vi.stubEnv('MONGODB_DB', 'finding05_access_code');
    vi.stubEnv('SESSION_SECRET', 'finding05-session-secret-must-be-32-chars-minimum');
    vi.stubEnv('JWT_SECRET', 'finding05-different-jwt-secret-32-chars-minimum');
    db = await connectMongoDB();

    const appA = createInstanceApp();
    const appB = createInstanceApp();
    serverA = appA.listen(0, '127.0.0.1');
    serverB = appB.listen(0, '127.0.0.1');
    await Promise.all([once(serverA, 'listening'), once(serverB, 'listening')]);
    baseUrlA = `http://127.0.0.1:${serverA.address().port}`;
    baseUrlB = `http://127.0.0.1:${serverB.address().port}`;
  }, 60000);

  afterAll(async () => {
    if (serverA) await new Promise((resolve) => serverA.close(resolve));
    if (serverB) await new Promise((resolve) => serverB.close(resolve));
    await disconnectMongoDB();
    if (mongo) await mongo.stop();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    vi.stubEnv('SESSION_SECRET', 'finding05-session-secret-must-be-32-chars-minimum');
    vi.stubEnv('JWT_SECRET', 'finding05-different-jwt-secret-32-chars-minimum');
    vi.stubEnv('ACCESS_CODE_MAX_ATTEMPTS', '3');
    vi.stubEnv('ACCESS_CODE_LOCKOUT_WINDOW_MS', '900000');

    for (const col of ['accessCodes', 'accessCodeLockouts']) {
      await db.collection(col).deleteMany({});
    }

    await db.collection('accessCodes').insertOne({
      id: 'invite_8481',
      code: '8481',
      active: true,
      usedCount: 0,
      maxUses: 10,
    });
  });

  it('EXPLOIT REPRODUCTION: enforces shared server-side lockout across multiple backend instances', async () => {
    const attackerHeaders = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.77',
    };

    // 2 failed attempts on Instance A
    const fail1 = await fetch(`${baseUrlA}/api/access-code/verify`, {
      method: 'POST',
      headers: attackerHeaders,
      body: JSON.stringify({ code: '0001' }),
    });
    expect(fail1.status).toBe(401);

    const fail2 = await fetch(`${baseUrlA}/api/access-code/verify`, {
      method: 'POST',
      headers: attackerHeaders,
      body: JSON.stringify({ code: '0002' }),
    });
    expect(fail2.status).toBe(401);

    // 3rd failed attempt on Instance B (cross-instance state in MongoDB)
    const fail3 = await fetch(`${baseUrlB}/api/access-code/verify`, {
      method: 'POST',
      headers: attackerHeaders,
      body: JSON.stringify({ code: '0003' }),
    });
    expect(fail3.status).toBe(401);

    // 4th attempt on Instance A — even with the VALID code — is locked out with 429
    const lockedAttemptA = await fetch(`${baseUrlA}/api/access-code/verify`, {
      method: 'POST',
      headers: attackerHeaders,
      body: JSON.stringify({ code: '8481' }),
    });
    expect(lockedAttemptA.status).toBe(429);
    expect(lockedAttemptA.headers.get('retry-after')).toBeTruthy();

    // 5th attempt on Instance B is also locked out with 429
    const lockedAttemptB = await fetch(`${baseUrlB}/api/access-code/verify`, {
      method: 'POST',
      headers: attackerHeaders,
      body: JSON.stringify({ code: '8481' }),
    });
    expect(lockedAttemptB.status).toBe(429);

    // Valid code was never consumed by the locked-out attacker
    const codeDoc = await db.collection('accessCodes').findOne({ code: '8481' });
    expect(codeDoc.usedCount).toBe(0);

    // A legitimate user from a different IP can still verify the valid code on Instance B
    const legitimateRes = await fetch(`${baseUrlB}/api/access-code/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.50',
      },
      body: JSON.stringify({ code: '8481' }),
    });
    expect(legitimateRes.status).toBe(200);
    const legitimateBody = await legitimateRes.json();
    expect(legitimateBody.valid).toBe(true);
  });

  it('clears failed attempt counter upon a successful verification before lockout threshold', async () => {
    const clientHeaders = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.88',
    };

    // 2 failed attempts (threshold is 3)
    await fetch(`${baseUrlA}/api/access-code/verify`, {
      method: 'POST',
      headers: clientHeaders,
      body: JSON.stringify({ code: '1111' }),
    });
    await fetch(`${baseUrlB}/api/access-code/verify`, {
      method: 'POST',
      headers: clientHeaders,
      body: JSON.stringify({ code: '2222' }),
    });

    // 3rd attempt is valid -> succeeds and clears failure record
    const okRes = await fetch(`${baseUrlA}/api/access-code/verify`, {
      method: 'POST',
      headers: clientHeaders,
      body: JSON.stringify({ code: '8481' }),
    });
    expect(okRes.status).toBe(200);

    const lockoutDoc = await db.collection('accessCodeLockouts').findOne({ _id: '198.51.100.88' });
    expect(lockoutDoc).toBeNull();
  });

  it('enforces httpOnly: true on access_session in frontend verify route and removes document.cookie write in page.tsx', () => {
    const repoRoot = path.resolve(process.cwd(), '..');
    const verifyRouteSource = fs.readFileSync(
      path.join(repoRoot, 'frontend/app/api/access-code/verify/route.ts'),
      'utf8',
    );
    const accessCodePageSource = fs.readFileSync(
      path.join(repoRoot, 'frontend/app/(app)/access-code/page.tsx'),
      'utf8',
    );

    expect(verifyRouteSource).toContain('httpOnly: true');
    expect(verifyRouteSource).not.toContain('httpOnly: false');
    expect(accessCodePageSource).not.toContain('document.cookie');
  });
});
