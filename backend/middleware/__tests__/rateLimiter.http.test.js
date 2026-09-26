import express from 'express';
import { once } from 'node:events';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

// Exercise the real limiter and IP helpers; only replace external persistence.
vi.mock('../mongoRateLimitStore.js', async () => {
  const { MemoryStore } = await import('express-rate-limit');
  return { MongoRateLimitStore: class extends MemoryStore {} };
});

let server;
let origin;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const { authLimiter } = await import('../rateLimiter.js');
  const app = express();
  app.set('trust proxy', 'loopback');
  app.get('/auth/probe', authLimiter, (_req, res) => res.json({ ok: true }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  vi.unstubAllEnvs();
});

it.each([
  ['203.0.113.4:1000', '::ffff:203.0.113.4', '203.0.113.5'],
  ['[2001:db8:1234:5600::1]:1000', '2001:db8:1234:56ff::2', '2001:db8:1234:5700::1'],
])('enforces the production bucket for %s across normalized proxy addresses', async (initial, sameBucket, otherBucket) => {
  const request = ip => fetch(`${origin}/auth/probe`, { headers: { 'x-forwarded-for': ip } });
  for (let i = 0; i < 100; i++) {
    const response = await request(initial);
    expect(response.status).toBe(200);
    await response.text();
  }
  const blocked = await request(sameBucket);
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get('ratelimit-limit')).toBe('100');
  expect(blocked.headers.get('ratelimit-remaining')).toBe('0');
  expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  expect(blocked.headers.get('x-ratelimit-limit')).toBeNull();
  expect(await blocked.json()).toEqual({ error: 'Too many authentication attempts, please try again later.' });
  const allowed = await request(otherBucket);
  expect(allowed.status).toBe(200);
  await allowed.text();
});
