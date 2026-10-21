import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyGate } from './ci-gate.mjs';

function results(mode, full) {
  const jobs = mode === 'fast'
    ? ['lint-and-typecheck', 'frontend-tests', 'backend-tests', 'security-and-vulnerability-scan', 'build-and-analyze', 'browser-smoke']
    : ['fast-quality-gate', 'browser-regression', 'lighthouse'];
  const needs = Object.fromEntries(['policy', ...jobs].map(job => [job, { result: 'success' }]));
  needs.policy.outputs = { full_validation: String(full) };
  if (mode === 'fast' && full) needs['browser-smoke'].result = 'skipped';
  if (mode === 'release' && !full) {
    needs['browser-regression'].result = 'skipped';
    needs.lighthouse.result = 'skipped';
  }
  return needs;
}

for (const mode of ['fast', 'release']) {
  for (const full of [true, false]) {
    test(`${mode} gate accepts only the expected ${full ? 'full' : 'fast'} job results`, () => {
      verifyGate(results(mode, full), mode);
      for (const job of Object.keys(results(mode, full))) {
        for (const bad of ['failure', 'cancelled', 'skipped', 'success']) {
          const needs = results(mode, full);
          if (needs[job].result === bad) continue;
          needs[job].result = bad;
          assert.throws(() => verifyGate(needs, mode), new RegExp(job));
        }
        const needs = results(mode, full);
        delete needs[job];
        assert.throws(() => verifyGate(needs, mode));
      }
    });
  }
}

test('missing policy and unknown gate cannot report success', () => {
  assert.throws(() => verifyGate({}, 'fast'), /policy/);
  assert.throws(() => verifyGate(results('fast', true), 'other'), /Unknown gate/);
  const needs = results('release', true);
  needs['new-required-check'] = { result: 'failure' };
  assert.throws(() => verifyGate(needs, 'release'), /Unexpected gate dependency/);
});
