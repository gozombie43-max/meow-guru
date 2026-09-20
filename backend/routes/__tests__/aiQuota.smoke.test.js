import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import aiRoutes from '../aiRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

describe('AI Route Smoke Check - /api/ai/quota', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  it('rejects unauthenticated POST /api/ai/quota with 401 and never 500', async () => {
    const response = await fetch(`${baseUrl}/api/ai/quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'No token provided' });
  });

  it('rejects unauthenticated DELETE /api/ai/quota/:leaseId with 401 and never 500', async () => {
    const response = await fetch(`${baseUrl}/api/ai/quota/fake-lease-id`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'No token provided' });
  });
});
