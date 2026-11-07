import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('VULN-10 Regression: CI/CD Workflow Hardening', () => {
  const repoRoot = path.resolve(process.cwd(), '..');

  it('enforces refs/heads/main branch guard in main_quizguru-backend.yml', () => {
    const workflowPath = path.join(repoRoot, '.github/workflows/main_quizguru-backend.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('refs/heads/main');
  });

  it('pins prom/prometheus container image to an immutable @sha256 digest in ci-verify.yml', () => {
    const workflowPath = path.join(repoRoot, '.github/workflows/ci-verify.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toMatch(/prom\/prometheus:v3\.5\.0@sha256:[a-f0-9]{64}/);
  });

  it('audits root and @meow/contracts dependencies in ci-verify.yml security scan job', () => {
    const workflowPath = path.join(repoRoot, '.github/workflows/ci-verify.yml');
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('npm audit --workspace backend --audit-level=high');
    expect(content).toContain('npm audit --workspace frontend --audit-level=high');
    expect(content).toMatch(/npm audit --workspace @meow\/contracts --audit-level=high|npm audit --omit=dev --audit-level=high/);
  });
});
