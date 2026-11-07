import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CRITICAL_SMOKE_SPECS,
  DESKTOP_FULL_SPECS,
  MOBILE_FULL_SPECS,
  selectE2ESpecs,
} from './select-e2e-specs.mjs';

test('main branch pushes, scheduled runs, and manual dispatches run the full curated project suite', () => {
  for (const trigger of [
    { eventName: 'push', ref: 'refs/heads/main', changedFiles: ['frontend/components/LangToggle.tsx'] },
    { eventName: 'schedule', ref: 'refs/heads/main', changedFiles: ['frontend/components/LangToggle.tsx'] },
    { eventName: 'workflow_dispatch', ref: 'refs/heads/main', changedFiles: ['frontend/components/LangToggle.tsx'] },
  ]) {
    assert.deepEqual(selectE2ESpecs({ ...trigger, project: 'desktop' }), DESKTOP_FULL_SPECS);
    assert.deepEqual(selectE2ESpecs({ ...trigger, project: 'mobile' }), MOBILE_FULL_SPECS);
  }
});

test('desktop and mobile full suites avoid viewport-redundant specs', () => {
  assert.ok(DESKTOP_FULL_SPECS.includes('e2e/navigation.spec.ts'));
  assert.ok(!MOBILE_FULL_SPECS.includes('e2e/navigation.spec.ts'));
  assert.ok(DESKTOP_FULL_SPECS.includes('e2e/paper-image-zip.spec.ts'));
  assert.ok(!MOBILE_FULL_SPECS.includes('e2e/paper-image-zip.spec.ts'));
  assert.ok(MOBILE_FULL_SPECS.includes('e2e/home-hero-carousel.spec.ts'));
  assert.ok(!DESKTOP_FULL_SPECS.includes('e2e/home-hero-carousel.spec.ts'));
  assert.ok(MOBILE_FULL_SPECS.includes('e2e/mobile-quiz-design.spec.ts'));
  assert.ok(!DESKTOP_FULL_SPECS.includes('e2e/mobile-quiz-design.spec.ts'));
});

test('pull requests with backend-only non-browser changes run only the critical smoke suite', () => {
  const changedFiles = ['backend/tests/security/vuln01.test.js'];
  assert.deepEqual(
    selectE2ESpecs({ project: 'desktop', eventName: 'pull_request', changedFiles }),
    CRITICAL_SMOKE_SPECS,
  );
  assert.deepEqual(
    selectE2ESpecs({ project: 'mobile', eventName: 'pull_request', changedFiles }),
    CRITICAL_SMOKE_SPECS,
  );
});

test('pull requests with quiz engine changes add targeted desktop and mobile quiz specs', () => {
  const changedFiles = ['frontend/features/quiz/components/views/MobileQuizView.tsx'];
  const desktop = selectE2ESpecs({ project: 'desktop', eventName: 'pull_request', changedFiles });
  const mobile = selectE2ESpecs({ project: 'mobile', eventName: 'pull_request', changedFiles });

  assert.deepEqual(desktop, [
    ...CRITICAL_SMOKE_SPECS,
    'e2e/architecture.spec.ts',
    'e2e/concept-group-status.spec.ts',
    'e2e/remaining-performance.spec.ts',
  ]);
  assert.deepEqual(mobile, [
    ...CRITICAL_SMOKE_SPECS,
    'e2e/architecture.spec.ts',
    'e2e/mobile-quiz-design.spec.ts',
    'e2e/remaining-performance.spec.ts',
  ]);
});

test('pull requests with CSS or responsive layout changes add mobile and desktop visual checks', () => {
  const changedFiles = ['frontend/app/interface.css'];
  const mobile = selectE2ESpecs({ project: 'mobile', eventName: 'pull_request', changedFiles });
  assert.ok(mobile.includes('e2e/home-hero-carousel.spec.ts'));
  assert.ok(mobile.includes('e2e/mobile-quiz-design.spec.ts'));
  assert.ok(mobile.includes('e2e/architecture.spec.ts'));
});

test('pull requests with authentication or session bootstrap changes add session persistence checks', () => {
  const changedFiles = ['frontend/proxy.ts', 'frontend/lib/early-session.ts'];
  const desktop = selectE2ESpecs({ project: 'desktop', eventName: 'pull_request', changedFiles });
  assert.deepEqual(desktop, [...CRITICAL_SMOKE_SPECS, 'e2e/remaining-performance.spec.ts']);
});
