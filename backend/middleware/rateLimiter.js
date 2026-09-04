// middleware/rateLimiter.js

import rateLimit, {
  ipKeyGenerator,
} from 'express-rate-limit';


/**
 * Azure App Service can expose req.ip as:
 *
 *   42.108.149.216:8076
 *
 * express-rate-limit expects:
 *
 *   42.108.149.216
 *
 * Also safely handles IPv6 and IPv4-mapped IPv6.
 */
function normalizeClientIp(ip) {
  let value =
    String(ip || '').trim();

  if (!value) {
    return null;
  }

  // [IPv6]:port
  const bracketedIpv6 =
    value.match(
      /^\[([^\]]+)\](?::\d+)?$/
    );

  if (bracketedIpv6) {
    value =
      bracketedIpv6[1];
  }

  // IPv4:port
  const ipv4WithPort =
    value.match(
      /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/
    );

  if (ipv4WithPort) {
    value =
      ipv4WithPort[1];
  }

  // ::ffff:192.168.1.1
  if (
    value.startsWith(
      '::ffff:'
    ) &&
    value.includes('.')
  ) {
    value =
      value.slice(7);
  }

  return value;
}


/**
 * Generate a safe IP-based limiter key.
 *
 * ipKeyGenerator is retained so IPv6 addresses
 * are handled correctly by express-rate-limit.
 */
function requestIpKey(req) {
  const normalizedIp =
    normalizeClientIp(
      req.ip ||
      req.socket?.remoteAddress
    );

  if (!normalizedIp) {
    return 'unknown-client';
  }

  return ipKeyGenerator(
    normalizedIp
  );
}


/**
 * Prefer authenticated user identity where available.
 * Otherwise fall back to normalized client IP.
 */
const userKeyGenerator = (req) =>
  req.user?.id ||
  req.user?._id ||
  req.cookies?.userId ||
  requestIpKey(req);


// Global
export const globalLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max:
      process.env.NODE_ENV !== 'production' ? 10000 : 300,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      userKeyGenerator,

    message: {
      error:
        'Too many requests, please try again later.',
    },
  });


// Authentication
export const authLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max:
      20,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    // IMPORTANT on Azure
    keyGenerator:
      requestIpKey,

    message: {
      error:
        'Too many authentication attempts, please try again later.',
    },
  });


// AI
export const aiLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max:
      20,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      userKeyGenerator,

    message: {
      error:
        'AI rate limit reached, please try again later.',
    },
  });


// Agents
export const agentLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max:
      30,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      userKeyGenerator,

    message: {
      error:
        'Agent rate limit reached, please try again later.',
    },
  });


// Uploads
export const uploadLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max:
      30,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    // Handles Azure IP:port
    keyGenerator:
      userKeyGenerator,

    message: {
      error:
        'Upload rate limit reached, please try again later.',
    },
  });
