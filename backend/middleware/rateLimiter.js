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
 * Helper to detect local development traffic that must never be rate limited.
 */
const isDevOrLocal = (req) => {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const ip = String(req.ip || req.socket?.remoteAddress || '');
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.endsWith('127.0.0.1') ||
    ip === 'localhost' ||
    ip === '::ffff:127.0.0.1'
  );
};

/**
 * Prefer authenticated user identity where available.
 * Otherwise fall back to normalized client IP.
 */
const userKeyGenerator = (req) =>
  req.user?.id ||
  req.user?._id ||
  req.cookies?.userId ||
  requestIpKey(req);


// Global Limiter
export const globalLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max:
      process.env.NODE_ENV !== 'production' ? 100000 : 5000,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      userKeyGenerator,

    skip: (req) => {
      // Always skip for non-production or local loopback
      if (isDevOrLocal(req)) return true;

      // Skip HTTP OPTIONS preflight requests
      if (req.method === 'OPTIONS') return true;

      const path = req.path || '';
      const url = req.originalUrl || req.url || '';

      // Skip health checks and root ping
      if (path === '/' || path === '/health' || url === '/' || url === '/health') return true;

      // Skip static uploads and image requests
      if (path.startsWith('/uploads') || url.startsWith('/uploads')) return true;

      // Skip reading PDFs, notes, and streaming content
      if (path.startsWith('/api/pdfs') || url.startsWith('/api/pdfs')) return true;

      return false;
    },

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
      process.env.NODE_ENV !== 'production' ? 10000 : 100,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      requestIpKey,

    skip:
      isDevOrLocal,

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
      process.env.NODE_ENV !== 'production' ? 10000 : 100,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      userKeyGenerator,

    skip:
      isDevOrLocal,

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
      process.env.NODE_ENV !== 'production' ? 10000 : 150,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      userKeyGenerator,

    skip:
      isDevOrLocal,

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
      process.env.NODE_ENV !== 'production' ? 10000 : 200,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    keyGenerator:
      userKeyGenerator,

    skip:
      isDevOrLocal,

    message: {
      error:
        'Upload rate limit reached, please try again later.',
    },
  });
