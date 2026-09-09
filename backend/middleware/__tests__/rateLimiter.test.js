import { afterEach, expect, it, vi } from 'vitest';
vi.mock('express-rate-limit', () => ({ default: options => options, ipKeyGenerator: value => value }));
import { authLimiter, aiLimiter, globalLimiter } from '../rateLimiter.js';
afterEach(() => vi.unstubAllEnvs());
it('enforces production limits on loopback proxy traffic', () => {
  vi.stubEnv('NODE_ENV', 'production');
  for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    const request = { ip, path: '/auth/login', method: 'POST' };
    expect(authLimiter.skip(request)).toBe(false);
    expect(aiLimiter.skip(request)).toBe(false);
    expect(globalLimiter.skip(request)).toBe(false);
  }
});
it('retains development and production health exemptions', () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(authLimiter.skip({ ip: '127.0.0.1' })).toBe(true);
  vi.stubEnv('NODE_ENV', 'production');
  expect(globalLimiter.skip({ path: '/health', method: 'GET' })).toBe(true);
});
