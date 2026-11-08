import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('FINDING-03 Regression: CI/CD Staging Production DB Isolation, Digest Pinning & Artifact Scoping', () => {
  const repoRoot = path.resolve(process.cwd(), '..');

  it('EXPLOIT REPRODUCTION: eliminates production MONGODB_URI and production Web App settings access from staging workflow', () => {
    const stagingWorkflowPath = path.join(repoRoot, '.github/workflows/main_quizguru-backend-staging.yml');
    const content = fs.readFileSync(stagingWorkflowPath, 'utf8');

    // Staging workflow must never read production Web App settings or production MONGODB_URI secret
    expect(content).not.toContain('PRODUCTION_RESOURCE_GROUP');
    expect(content).not.toContain('PRODUCTION_APP_NAME');
    expect(content).not.toContain('secrets.MONGODB_URI');
    expect(content).not.toMatch(/\bquizguru-backend(?!-staging)\b/);

    // Question sync must default to false and be strictly gated to refs/heads/main
    expect(content).toMatch(/sync_questions:[\s\S]*?default:\s*false/);
    expect(content).toContain("inputs.sync_questions && github.ref == 'refs/heads/main'");
    expect(content).toContain("inputs.sync_questions && github.ref != 'refs/heads/main'");
  });

  it('pins redis:7.4-alpine service container image to an immutable @sha256 digest in ci-verify.yml', () => {
    const ciVerifyPath = path.join(repoRoot, '.github/workflows/ci-verify.yml');
    const content = fs.readFileSync(ciVerifyPath, 'utf8');

    expect(content).toMatch(/image:\s*redis:7\.4-alpine@sha256:[a-f0-9]{64}/);
  });

  it('scopes canary-decision artifact upload in backend-canary-promotion.yml to explicit health and decision files instead of *.json', () => {
    const canaryPath = path.join(repoRoot, '.github/workflows/backend-canary-promotion.yml');
    const content = fs.readFileSync(canaryPath, 'utf8');

    expect(content).not.toContain("path: '*.json'");
    expect(content).toContain('canary-health.json');
    expect(content).toContain('decision.json');
  });
});
