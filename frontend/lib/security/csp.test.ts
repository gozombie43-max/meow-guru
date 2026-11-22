import { expect, it } from 'vitest';
import { reportOnlyCsp } from './csp';

it('sets a report endpoint, removes unused third-party CDNs, and controls objects, framing and production scripts', () => {
  const policy = reportOnlyCsp('https://api.example.test/path?secret=hidden');
  expect(policy).toContain('report-uri /api/csp-report');
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'self'");
  expect(policy).toContain('https://api.example.test');
  expect(policy).not.toContain('cdn.jsdelivr.net');
  expect(policy).not.toContain('cdnjs.cloudflare.com');
  expect(policy).not.toContain('code.iconify.design');
  expect(policy).not.toContain('secret=hidden');
  expect(policy).not.toContain("'unsafe-eval'");
  expect(reportOnlyCsp('http://localhost:10000', true)).toContain("'unsafe-eval'");
});
