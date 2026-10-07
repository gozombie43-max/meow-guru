import { afterEach, expect, it, vi } from 'vitest';
import { validateEnvironment, isLocalEnvironment } from '../environment.js';
import { tutorPolicy, tutorTokenAllowance } from '../../services/tutorPolicy.js';
const valid = { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), REFRESH_TOKEN_SECRET: 'b'.repeat(40) };
it.each([undefined, 'meow:dev', 'meow:staging', 'shared-cache'])('requires a production Redis namespace instead of %s', REDIS_NAMESPACE => {
  expect(() => validateEnvironment({ ...valid, REDIS_URL: 'rediss://provider', REDIS_NAMESPACE })).toThrow('REDIS_NAMESPACE');
});
it('validates separate staging/production namespaces without echoing Redis credentials', () => {
  expect(validateEnvironment({ ...valid, REDIS_URL: 'rediss://provider', REDIS_NAMESPACE: 'meow:prod' }).REDIS_NAMESPACE).toBe('meow:prod');
  expect(validateEnvironment({ ...valid, DEPLOYMENT_ENVIRONMENT: 'staging', REDIS_URL: 'rediss://provider', REDIS_NAMESPACE: 'meow:staging' }).REDIS_NAMESPACE).toBe('meow:staging');
  expect(() => validateEnvironment({ ...valid, DEPLOYMENT_ENVIRONMENT: 'staging', REDIS_URL: 'rediss://secret@provider', REDIS_NAMESPACE: 'meow:prod' })).toThrow('staging namespace');
});
it('validates isolated queue namespace, critical flags and bounded admission settings', () => {
  expect(() => validateEnvironment({ ...valid, QUEUE_REDIS_URL: 'rediss://queue' })).toThrow('QUEUE_REDIS_NAMESPACE');
  expect(validateEnvironment({ ...valid, QUEUE_REDIS_URL: 'rediss://queue', QUEUE_REDIS_NAMESPACE: 'meow:prod:queue' }).QUEUE_REDIS_NAMESPACE).toBe('meow:prod:queue');
  expect(validateEnvironment({ ...valid, DEPLOYMENT_ENVIRONMENT: 'staging', QUEUE_REDIS_URL: 'rediss://queue', QUEUE_REDIS_NAMESPACE: 'meow:staging:queue' }).QUEUE_REDIS_NAMESPACE).toBe('meow:staging:queue');
  expect(() => validateEnvironment({ ...valid, QUEUE_REDIS_URL: 'rediss://queue', QUEUE_REDIS_NAMESPACE: 'meow:staging:queue' })).toThrow('QUEUE_REDIS_NAMESPACE');
  expect(() => validateEnvironment({ ...valid, QUEUE_MAX_WAITING_JOBS: '20001' })).toThrow('QUEUE_MAX_WAITING_JOBS');
  expect(() => validateEnvironment({ ...valid, BATTLE_REDIS_CRITICAL: 'maybe' })).toThrow('BATTLE_REDIS_CRITICAL');
  expect(validateEnvironment({ ...valid, QUEUE_REDIS_URL: 'redis://queue', REDIS_NAMESPACE: 'meow:prod' }).REDIS_NAMESPACE).toBe('meow:prod');
  expect(validateEnvironment({ ...valid, NODE_ENV: 'test', QUEUE_REDIS_URL: 'redis://queue' }).NODE_ENV).toBe('test');
  expect(() => validateEnvironment({ ...valid, DEPLOYMENT_ENVIRONMENT: 'staging', QUEUE_REDIS_URL: 'redis://queue', QUEUE_REDIS_NAMESPACE: 'meow:staging:prod' })).toThrow('QUEUE_REDIS_NAMESPACE');
  expect(() => validateEnvironment({ ...valid, QUEUE_REDIS_URL: 'redis://queue', QUEUE_REDIS_NAMESPACE: 'meow:prod:dev' })).toThrow('QUEUE_REDIS_NAMESPACE');
});
afterEach(() => vi.unstubAllEnvs());
it.each(['development', 'test', 'production'])('accepts explicit %s credentials', NODE_ENV => {
  expect(validateEnvironment({ ...valid, NODE_ENV }).NODE_ENV).toBe(NODE_ENV);
});
it.each([
  { NODE_ENV: undefined }, { NODE_ENV: 'staging' }, { JWT_SECRET: undefined },
  { REFRESH_TOKEN_SECRET: '' }, { JWT_SECRET: 'a' }, { JWT_SECRET: 'dev-fallback-secret-key-change-in-prod' },
  { JWT_SECRET: 'replace-with-a-long-random-secret' }, { REFRESH_TOKEN_SECRET: valid.JWT_SECRET },
  { DEPLOYMENT_ENVIRONMENT: 'staging', NODE_ENV: 'development' }, { TUTOR_RUNNING_JOBS: '0' },
])('fails closed for invalid environment %j', changes => expect(() => validateEnvironment({ ...valid, ...changes })).toThrow());
it('does not leak secret values into validation errors and refuses unknown limiter bypasses', () => {
  try { validateEnvironment({ ...valid, JWT_SECRET: 'sensitive-short' }); }
  catch (error) { expect(error.message).not.toContain('sensitive-short'); }
  expect(isLocalEnvironment({})).toBe(false);
  expect(isLocalEnvironment({ NODE_ENV: 'staging' })).toBe(false);
  expect(isLocalEnvironment({ NODE_ENV: 'production' })).toBe(false);
  expect(isLocalEnvironment({ NODE_ENV: 'test' })).toBe(true);
  expect(isLocalEnvironment({ NODE_ENV: 'development' })).toBe(true);
});
it('uses bounded configurable Tutor allowances and reserves attachment retries', () => {
  expect(tutorPolicy().TUTOR_RUNNING_JOBS).toBe(2);
  expect(tutorTokenAllowance({ message: 'x' }, true)).toBeGreaterThan(tutorTokenAllowance({ message: 'x' }, false) * 6);
  expect(tutorTokenAllowance(undefined, false)).toBe(18500);
  vi.stubEnv('TUTOR_DAILY_REQUESTS', '3');
  expect(tutorPolicy().TUTOR_DAILY_REQUESTS).toBe(3);
});
