import rateLimit from 'express-rate-limit';
import { isLocalEnvironment } from '../config/environment.js';
import { RedisRateLimitStore } from './redisRateLimitStore.js';
import { userKeyGenerator } from './rateLimiter.js';

const buildOptions = (prefix, limit, message, { outagePolicy = 'conservative' } = {}) => ({
  ...(!isLocalEnvironment() ? { store: new RedisRateLimitStore(prefix, { outagePolicy }) } : {}),
  windowMs: 60_000,
  limit: isLocalEnvironment() ? 10000 : limit,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  skip: () => process.env.NODE_ENV === 'test' || isLocalEnvironment(),
  message: { message },
});

export const battleReadLimiter = rateLimit(buildOptions('battle-read', 120, 'Too many Battle requests.', { outagePolicy: 'availability' }));
export const battleWriteLimiter = rateLimit(buildOptions('battle-write', 40, 'Too many Battle actions.'));
export const battleClaimLimiter = rateLimit(buildOptions('battle-claim', 20, 'Too many claim attempts.'));
