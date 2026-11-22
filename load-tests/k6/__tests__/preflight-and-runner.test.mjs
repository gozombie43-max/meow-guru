import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatPreflightSummary,
  runPreflight,
} from '../scripts/preflight.mjs';
import { executeRunner } from '../scripts/run-k6.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function withStubServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function createHealthyHandler({
  redisHealth = 'healthy',
  envName = 'staging',
  questionCount = 5,
  metaTotal = 120,
  loginStatus = 200,
} = {}) {
  const secretJwt = 'eyJhbGciOiJIUzI1NiJ9.SuperSecretPayload_XYZ987.Sig987';
  return (req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    res.setHeader('Content-Type', 'application/json');

    if (urlPath === '/api/health') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: true,
          state: 'ready',
          environment: envName,
          dependencies: {
            mongo: 'healthy',
            redis: redisHealth,
            redisCircuit: 'closed',
          },
        }),
      );
      return;
    }
    if (urlPath === '/auth/login') {
      res.statusCode = loginStatus;
      res.end(
        JSON.stringify(
          loginStatus === 200
            ? { token: secretJwt, user: { id: 'k6-u1', role: 'student' } }
            : { error: 'Invalid credentials' },
        ),
      );
      return;
    }
    if (urlPath === '/users/me') {
      res.statusCode = req.headers.authorization?.startsWith('Bearer ') ? 200 : 401;
      res.end(JSON.stringify(res.statusCode === 200 ? { id: 'k6-u1' } : { error: 'Unauthorized' }));
      return;
    }
    if (urlPath === '/api/questions/session') {
      const questions = Array.from({ length: questionCount }, (_, i) => ({
        questionUid: `q_stub_${i}`,
        question: `Q${i}`,
        options: ['A', 'B', 'C', 'D'],
      }));
      res.statusCode = 200;
      res.end(JSON.stringify({ questions, hasMore: questionCount >= 5 }));
      return;
    }
    if (urlPath === '/api/questions/meta') {
      res.statusCode = 200;
      res.end(JSON.stringify({ total: metaTotal }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}

const fakeK6Exec = () => 'k6 v2.4.0 (go1.23, windows/amd64)';

test('runPreflight passes all 10 checks cleanly and redacts secrets from text and JSON', async () => {
  const secretPass = 'SuperSecretPass_XYZ987';
  const secretMetrics = 'SecretMetricsToken_XYZ987';

  await withStubServer(createHealthyHandler({ envName: 'unknown', redisHealth: 'healthy' }), async (baseUrl) => {
    const report = await runPreflight({
      envName: 'local',
      profile: 'smoke',
      baseUrl,
      execCommand: fakeK6Exec,
      env: {
        K6_TEST_EMAIL: 'k6-load-1@loadtest.invalid',
        K6_TEST_PASSWORD: secretPass,
        K6_METRICS_TOKEN: secretMetrics,
      },
    });

    assert.equal(report.passed, true);
    assert.equal(report.passedCount, 10);
    assert.equal(report.failedCount, 0);

    const serialized = JSON.stringify(report);
    const formatted = formatPreflightSummary(report);
    for (const output of [serialized, formatted]) {
      assert.equal(output.includes(secretPass), false);
      assert.equal(output.includes(secretMetrics), false);
      assert.equal(output.includes('SuperSecretPayload_XYZ987'), false);
    }
  });
});

test('runPreflight fails safely on production targets, unapproved staging, bad auth, and required/degraded Redis', async () => {
  // 1. Production blocked
  const prodReport = await runPreflight({
    envName: 'production',
    profile: 'smoke',
    baseUrl: 'https://api.prod.meowguru.me',
    execCommand: fakeK6Exec,
    env: {},
  });
  assert.equal(prodReport.passed, false);
  assert.equal(prodReport.checks[1].status, 'FAIL');
  assert.equal(prodReport.checks[2].status, 'FAIL');

  // 2. Unapproved staging blocked
  const unapprovedStaging = await runPreflight({
    envName: 'staging',
    profile: 'smoke',
    baseUrl: 'https://quizguru-stage-1177891703.azurewebsites.net',
    execCommand: fakeK6Exec,
    env: { K6_AUTH_TOKEN: 'dummy-token' },
  });
  assert.equal(unapprovedStaging.passed, false);
  assert.equal(unapprovedStaging.checks[2].status, 'FAIL');

  // 3. Invalid credentials fail auth check without leaking password
  const badPass = 'WrongSecretPass_XYZ123';
  await withStubServer(createHealthyHandler({ loginStatus: 401 }), async (baseUrl) => {
    const authFail = await runPreflight({
      envName: 'local',
      profile: 'smoke',
      baseUrl,
      execCommand: fakeK6Exec,
      env: {
        K6_TEST_EMAIL: 'k6-1@loadtest.invalid',
        K6_TEST_PASSWORD: badPass,
      },
    });
    assert.equal(authFail.passed, false);
    assert.equal(authFail.checks[5].status, 'FAIL');
    assert.equal(JSON.stringify(authFail).includes(badPass), false);
  });

  // 4. Disabled Redis passes with warning when optional, fails when --require-redis is set
  await withStubServer(createHealthyHandler({ redisHealth: 'disabled' }), async (baseUrl) => {
    const optionalRedis = await runPreflight({
      envName: 'local',
      profile: 'smoke',
      baseUrl,
      execCommand: fakeK6Exec,
      env: { K6_AUTH_TOKEN: 'dummy-token' },
    });
    assert.equal(optionalRedis.passed, true);
    assert.ok(optionalRedis.checks[8].warning);

    const requiredRedis = await runPreflight({
      envName: 'local',
      profile: 'smoke',
      baseUrl,
      requireRedis: true,
      execCommand: fakeK6Exec,
      env: { K6_AUTH_TOKEN: 'dummy-token' },
    });
    assert.equal(requiredRedis.passed, false);
    assert.equal(requiredRedis.checks[8].status, 'FAIL');
  });

  // 5. Degraded Redis always fails Check 9
  await withStubServer(createHealthyHandler({ redisHealth: 'degraded' }), async (baseUrl) => {
    const degradedRedis = await runPreflight({
      envName: 'local',
      profile: 'smoke',
      baseUrl,
      execCommand: fakeK6Exec,
      env: { K6_AUTH_TOKEN: 'dummy-token' },
    });
    assert.equal(degradedRedis.passed, false);
    assert.equal(degradedRedis.checks[8].status, 'FAIL');
  });
});

test('run-k6 dry-run resolves local & approved staging plans and blocks production', async () => {
  const localDry = await executeRunner(
    ['--env', 'local', '--profile', 'smoke', '--dry-run'],
    { repoRoot: REPO_ROOT, execCommand: fakeK6Exec, env: {} },
  );
  assert.equal(localDry.exitCode, 0);
  assert.equal(localDry.plan.scriptRelPath, 'load-tests/k6/scenarios/mixed-workload.js');

  const stagingDry = await executeRunner(
    [
      '--env',
      'staging',
      '--allow-staging',
      '--profile',
      'target',
      '--base-url',
      'https://quizguru-stage-1177891703.azurewebsites.net',
      '--dry-run',
    ],
    { repoRoot: REPO_ROOT, execCommand: fakeK6Exec, env: {} },
  );
  assert.equal(stagingDry.exitCode, 0);
  assert.equal(stagingDry.plan.k6Profile, 'target');

  await assert.rejects(
    () =>
      executeRunner(['--env', 'production', '--profile', 'smoke', '--dry-run'], {
        repoRoot: REPO_ROOT,
        execCommand: fakeK6Exec,
        env: {},
      }),
    /production/i,
  );
});

test('Windows PowerShell launcher run.ps1 refuses production environment safely', () => {
  if (process.platform !== 'win32') return;
  const res = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(REPO_ROOT, 'load-tests/k6/run.ps1'),
      '-Environment',
      'production',
      '-Profile',
      'smoke',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  assert.notEqual(res.status, 0);
  assert.match(`${res.stdout}\n${res.stderr}`, /production/i);
});
