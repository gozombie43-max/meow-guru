import { afterEach, expect, it, vi } from 'vitest';
vi.mock('express-rate-limit', () => ({ default: options => options, ipKeyGenerator: value => value }));
import { authLimiter, authCredentialLimiter, aiLimiter, globalLimiter, trainingIngressLimiter, trainingLimiter } from '../rateLimiter.js';
import { signToken } from '../../auth/jwt.js';
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

it('uses the distributed global limiter for training unless local ingress is enabled', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const request = { path: '/api/training/sessions/a/actions', method: 'POST' };
  expect(globalLimiter.skip(request)).toBe(false);
  expect(trainingIngressLimiter.skip(request)).toBe(true);
  vi.stubEnv('TRAINING_LOCAL_INGRESS', 'true');
  expect(globalLimiter.skip(request)).toBe(true);
  expect(trainingIngressLimiter.skip(request)).toBe(false);
  expect(trainingLimiter.skip(request)).toBe(false);
  for (const path of ['/api/training-other', '/api/auth/login']) {
    expect(globalLimiter.skip({ ...request, path })).toBe(false);
  }
});

it('keys credential attempts by normalized account instead of shared NAT IP', () => {
  const first = authCredentialLimiter.keyGenerator({ body: { email: ' Student@Example.com ' }, ip: '10.0.0.1' });
  const sameAccount = authCredentialLimiter.keyGenerator({ body: { email: 'student@example.com' }, ip: '10.0.0.2' });
  const otherAccount = authCredentialLimiter.keyGenerator({ body: { email: 'other@example.com' }, ip: '10.0.0.1' });
  expect(first).toBe('account:student@example.com');
  expect(sameAccount).toBe(first);
  expect(otherAccount).not.toBe(first);
});

it('gives valid signed users independent global buckets behind one IP', () => {
  const first = signToken({ id: 'learner-a' });
  const second = signToken({ id: 'learner-b' });
  const shared = { ip: '203.0.113.10' };
  expect(globalLimiter.keyGenerator({ ...shared, headers: { authorization: `Bearer ${first}` } })).toBe('user:learner-a');
  expect(globalLimiter.keyGenerator({ ...shared, headers: { authorization: `Bearer ${second}` } })).toBe('user:learner-b');
  expect(globalLimiter.keyGenerator({ ...shared, headers: { authorization: 'Bearer invalid' } })).toContain('ip:');
});
