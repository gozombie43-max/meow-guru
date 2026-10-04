import { afterEach, expect, it, vi } from 'vitest';
import { validateEnvironment, isLocalEnvironment } from '../environment.js';
import { tutorPolicy, tutorTokenAllowance } from '../../services/tutorPolicy.js';
const valid = { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), REFRESH_TOKEN_SECRET: 'b'.repeat(40) };
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
