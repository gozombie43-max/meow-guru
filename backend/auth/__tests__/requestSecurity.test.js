import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTrustedOrigin, requireTrustedOrigin } from '../requestOrigin.js';
import { oauthStateStore } from '../oauthState.js';

const { save, consume } = vi.hoisted(() => ({ save: vi.fn(), consume: vi.fn() }));
vi.mock('../../repositories/oauthStateRepository.js', () => ({ saveOAuthState: save, consumeOAuthState: consume }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('cookie origin protection', () => {
  it('requires explicit production origins', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('FRONTEND_URL', 'https://quiz.example');
    expect(isTrustedOrigin('https://quiz.example')).toBe(true);
    for (const value of [undefined, 'null', 'http://localhost:3000', 'https://quiz.example.attacker.com']) expect(isTrustedOrigin(value)).toBe(false);
  });
  it('supports a trusted referrer and rejects missing origins', () => {
    vi.stubEnv('FRONTEND_URL', 'https://quiz.example');
    const next = vi.fn(); const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    requireTrustedOrigin({ headers: { referer: 'https://quiz.example/quiz' } }, res, next);
    expect(next).toHaveBeenCalledOnce();
    requireTrustedOrigin({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('OAuth state', () => {
  const response = () => ({ cookie: vi.fn(), clearCookie: vi.fn() });
  it('binds a single-use server nonce to an HttpOnly browser cookie', async () => {
    save.mockResolvedValue(undefined); consume.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = response();
    const state = await new Promise((resolve, reject) => oauthStateStore.store({ res }, (err, value) => err ? reject(err) : resolve(value)));
    expect(res.cookie).toHaveBeenCalledWith('oauthState', state, expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
    const req = { res, cookies: { oauthState: state } };
    const verify = () => new Promise((resolve, reject) => oauthStateStore.verify(req, state, (err, valid) => err ? reject(err) : resolve(valid)));
    expect(await verify()).toBe(true); expect(await verify()).toBe(false);
    expect(save.mock.calls[0][0]).not.toBe(state);
  });
  it('rejects missing and mismatched browser cookies without consuming state', () => {
    const done = vi.fn();
    oauthStateStore.verify({ res: response(), cookies: {} }, 'a'.repeat(64), done);
    expect(done).toHaveBeenCalledWith(null, false, expect.any(Object));
    expect(consume).not.toHaveBeenCalled();
  });
});
