import rateLimit from 'express-rate-limit';
import { isLocalEnvironment } from '../config/environment.js';
import { RedisRateLimitStore } from './redisRateLimitStore.js';
import { userKeyGenerator } from './rateLimiter.js';

const create = (prefix, limit, message, { outagePolicy = 'conservative' } = {}) =>
  rateLimit({
    ...(!isLocalEnvironment() ? { store: new RedisRateLimitStore(prefix, { outagePolicy }) } : {}),
    windowMs: 60_000,
    limit: isLocalEnvironment() ? 10000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userKeyGenerator,
    skip: () => process.env.NODE_ENV === 'test' || isLocalEnvironment(),
    message: { message },
  });

export const battleReadLimiter = create('battle-read', 120, 'Too many Battle requests.', { outagePolicy: 'availability' });
export const battleWriteLimiter = create('battle-write', 40, 'Too many Battle actions.');
export const battleClaimLimiter = create('battle-claim', 20, 'Too many claim attempts.');
