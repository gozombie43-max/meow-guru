import rateLimit from "express-rate-limit";
const create = (limit, message) => rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false, message: { message } });
export const battleReadLimiter = create(120, "Too many Battle requests.");
export const battleWriteLimiter = create(40, "Too many Battle actions.");
export const battleClaimLimiter = create(20, "Too many claim attempts.");
