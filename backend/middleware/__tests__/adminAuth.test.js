import { beforeEach, expect, it, vi } from 'vitest';
import adminAuth from '../auth.js';
import { verifyToken } from '../../auth/jwt.js';
import { assertSession } from '../../auth/sessions.js';
import { findCurrentAdminUser } from '../../repositories/adminUserRepository.js';

vi.mock('../../auth/jwt.js', () => ({ verifyToken: vi.fn() }));
vi.mock('../../auth/sessions.js', () => ({ assertSession: vi.fn() }));
vi.mock('../../repositories/adminUserRepository.js', () => ({ findCurrentAdminUser: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(verifyToken).mockReturnValue({ id: 'creator', role: 'superadmin' });
  vi.mocked(assertSession).mockResolvedValue(undefined);
});

async function check(user, authorization = 'Bearer token') {
  vi.mocked(findCurrentAdminUser).mockResolvedValue(user);
  const req = { headers: { authorization } };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await adminAuth(req, res, next);
  return { req, res, next };
}

it.each(['admin', 'superadmin'])('allows active %s to manage papers', async role => {
  const { req, next } = await check({ id: 'creator', role, status: 'active' });
  expect(next).toHaveBeenCalledWith();
  expect(req.user.role).toBe(role);
});

it.each(['user', 'student', 'moderator', 'unknown', undefined])('rejects current role %s even with elevated token claims', async role => {
  const { res, next } = await check({ id: 'creator', role });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

it.each(['suspended', 'banned'])('rejects %s admins', async status => {
  const { res, next } = await check({ id: 'creator', role: 'admin', status });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

it('rejects anonymous requests', async () => {
  const { res, next } = await check(null, '');
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

it('rejects revoked sessions', async () => {
  vi.mocked(assertSession).mockRejectedValue(Object.assign(new Error('Revoked'), { statusCode: 401 }));
  const { res, next } = await check({ id: 'creator', role: 'admin' });
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});
