import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import firebaseAuthRoutes from '../firebaseAuth.routes.js';

const { createCustomToken, verifyToken, assertSession } = vi.hoisted(() => ({
  createCustomToken: vi.fn(), verifyToken: vi.fn(), assertSession: vi.fn(),
}));
vi.mock('../../config/firebase.js', () => ({ firebaseAuth: { createCustomToken } }));
vi.mock('../../auth/jwt.js', () => ({ verifyToken }));
vi.mock('../../auth/sessions.js', () => ({ assertSession }));

describe('Firebase custom authentication bridge', () => {
  let server;
  let baseUrl;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/auth/firebase', firebaseAuthRoutes);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  beforeEach(() => {
    vi.resetAllMocks();
    verifyToken.mockReturnValue({ id: 'meow-user' });
    assertSession.mockResolvedValue({ id: 'meow-user' });
    createCustomToken.mockResolvedValue('custom-token');
  });
  const post = (body = {}, token = 'meow-jwt') => fetch(`${baseUrl}/auth/firebase/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

  it('rejects missing authentication without minting a Firebase token', async () => {
    const response = await post({}, null);
    expect(response.status).toBe(401);
    expect(createCustomToken).not.toHaveBeenCalled();
  });
  it('rejects expired JWTs and revoked Meow sessions', async () => {
    verifyToken.mockImplementationOnce(() => { throw Object.assign(new Error('expired'), { name: 'TokenExpiredError' }); });
    expect((await post()).status).toBe(401);
    assertSession.mockRejectedValueOnce(Object.assign(new Error('revoked'), { statusCode: 401 }));
    expect((await post()).status).toBe(401);
    expect(createCustomToken).not.toHaveBeenCalled();
  });
  it('mints only for the authenticated identity, ignores client claims, and prevents caching', async () => {
    const response = await post({ uid: 'another-user', claims: { admin: true } });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(createCustomToken).toHaveBeenCalledExactlyOnceWith('meow-user');
    expect(await response.json()).toMatchObject({ uid: 'meow-user', token: 'custom-token' });
  });
  it('validates the current Meow identity without minting, and rejects revoked sessions', async () => {
    const validate = () => fetch(`${baseUrl}/auth/firebase/session`, { method: 'POST', headers: { Authorization: 'Bearer meow-jwt' } });
    const response = await validate();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ uid: 'meow-user' });
    expect(assertSession).toHaveBeenCalledOnce();
    expect(createCustomToken).not.toHaveBeenCalled();
    assertSession.mockRejectedValueOnce(Object.assign(new Error('revoked'), { statusCode: 401 }));
    expect((await validate()).status).toBe(401);
  });
  it('does not expose Firebase credentials or provider errors', async () => {
    createCustomToken.mockRejectedValue(new Error('private signing credential failure'));
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Firebase authentication is unavailable. Please retry shortly.' });
  });
});
