import { afterEach, expect, it, vi } from 'vitest';
vi.mock('express-rate-limit', () => ({ default: options => options, ipKeyGenerator: value => value }));
import { authLimiter, aiLimiter, globalLimiter, trainingIngressLimiter, trainingLimiter } from '../rateLimiter.js';
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

it('only replaces the global training counter when a guarded rollout is enabled', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TRAINING_LOCAL_INGRESS', 'true');
  const request = { path: '/api/training/sessions/a/actions', method: 'POST' };
  expect(globalLimiter.skip(request)).toBe(true);
  expect(trainingIngressLimiter.skip(request)).toBe(false);
  expect(trainingLimiter.skip(request)).toBe(false);
  for (const path of ['/api/training-other', '/api/auth/login']) {
    expect(globalLimiter.skip({ ...request, path })).toBe(false);
    expect(trainingIngressLimiter.skip({ ...request, path })).toBe(true);
  }
  vi.stubEnv('TRAINING_LOCAL_INGRESS', 'false');
  expect(globalLimiter.skip(request)).toBe(false);
});
