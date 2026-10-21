import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { changedPushFiles, verificationPolicy } from './ci-policy.mjs';

const mainPush = { eventName: 'push', ref: 'refs/heads/main' };

test('production changes select full verification and backend deployment', () => {
  for (const file of ['backend/index.js', 'contracts/src/index.ts', 'package.json', 'package-lock.json', '.github/workflows/ci-verify.yml', '.github/workflows/main_quizguru-backend.yml', 'scripts/ci-policy.mjs']) {
    assert.deepEqual(verificationPolicy({ ...mainPush, changedFiles: [file] }), {
      full_validation: true, lighthouse: true, deploy_backend: true,
    });
  }
});

test('frontend-only main pushes retain full verification without deploying Azure', () => {
  assert.deepEqual(verificationPolicy({ ...mainPush, changedFiles: ['frontend/app/page.tsx'] }), {
    full_validation: true, lighthouse: true, deploy_backend: false,
  });
});

test('development pushes use fast checks; PRs require the full suite', () => {
  for (const ref of ['refs/heads/develop', 'refs/heads/feature/example']) {
    assert.deepEqual(verificationPolicy({ eventName: 'push', ref }), {
      full_validation: false, lighthouse: false, deploy_backend: false,
    });
  }
  assert.deepEqual(verificationPolicy({ eventName: 'pull_request', ref: 'refs/pull/12/merge' }), {
    full_validation: true, lighthouse: true, deploy_backend: false,
  });
});

test('reusable staging verification cannot trigger production even with inherited push context', () => {
  assert.deepEqual(verificationPolicy({ ...mainPush, verificationOnly: true }), {
    full_validation: true, lighthouse: true, deploy_backend: false,
  });
});

test('manual deployments require main and retain full checks', () => {
  assert.equal(verificationPolicy({ eventName: 'workflow_dispatch', ref: mainPush.ref, deployBackend: true }).deploy_backend, true);
  assert.equal(verificationPolicy({ eventName: 'workflow_dispatch', ref: mainPush.ref }).deploy_backend, false);
  for (const input of [
    { ...mainPush, deployBackend: true },
    { eventName: 'workflow_dispatch', ref: 'refs/heads/develop', deployBackend: true },
    { eventName: 'workflow_dispatch', ref: mainPush.ref, deployBackend: true, verificationOnly: true },
  ]) assert.throws(() => verificationPolicy(input), /standalone workflow dispatch on main/);
});

test('unknown push bases fail safe; scheduled verification never deploys', () => {
  assert.equal(changedPushFiles({ before: '0'.repeat(40) }, 'unused'), null);
  assert.equal(changedPushFiles({}, 'unused'), null);
  assert.equal(verificationPolicy(mainPush).deploy_backend, true);
  assert.deepEqual(verificationPolicy({ eventName: 'schedule', ref: mainPush.ref }), {
    full_validation: true, lighthouse: true, deploy_backend: false,
  });
});

test('push ranges include every commit and the old path of a renamed backend file', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'meow-ci-policy-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = () => {
    git('add', '.');
    git('-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init', '-q');
    mkdirSync(join(cwd, 'backend'));
    mkdirSync(join(cwd, 'frontend'));
    writeFileSync(join(cwd, 'backend', 'runtime.js'), 'export default true;\n');
    const before = commit();
    renameSync(join(cwd, 'backend', 'runtime.js'), join(cwd, 'frontend', 'runtime.js'));
    commit();
    writeFileSync(join(cwd, 'frontend', 'page.js'), 'export default null;\n');
    const sha = commit();
    const changedFiles = changedPushFiles({ before }, sha, cwd);
    assert.deepEqual(changedFiles.sort(), ['backend/runtime.js', 'frontend/page.js', 'frontend/runtime.js']);
    assert.equal(verificationPolicy({ ...mainPush, changedFiles }).deploy_backend, true);
    assert.equal(changedPushFiles({ before: 'f'.repeat(40) }, sha, cwd), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('CLI writes GitHub outputs and enforces the manual deployment boundary', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'meow-ci-outputs-'));
  const eventPath = join(cwd, 'event.json');
  const outputPath = join(cwd, 'outputs.txt');
  const script = fileURLToPath(new URL('./ci-policy.mjs', import.meta.url));
  writeFileSync(eventPath, '{}');
  const env = {
    ...process.env,
    GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath,
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
    VERIFICATION_ONLY: '', DEPLOY_BACKEND: 'true',
  };
  const run = overrides => execFileSync(process.execPath, [script], { env: { ...env, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    run({});
    assert.equal(readFileSync(outputPath, 'utf8'), 'full_validation=true\nlighthouse=true\ndeploy_backend=true\n');
    writeFileSync(outputPath, '');
    run({ VERIFICATION_ONLY: 'true', DEPLOY_BACKEND: '' });
    assert.equal(readFileSync(outputPath, 'utf8'), 'full_validation=true\nlighthouse=true\ndeploy_backend=false\n');
    assert.throws(() => run({ GITHUB_REF: 'refs/heads/develop' }));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
