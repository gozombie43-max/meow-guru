import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), compare: vi.fn(), local: null }));
vi.mock('../../repositories/authRegistrationRepository.js', () => ({
  findUserByEmail: mocks.find, normalizeAccountEmail: (email) => email, authUserProjection: {},
}));
vi.mock('passport', () => ({ default: { use: vi.fn(), serializeUser: vi.fn(), deserializeUser: vi.fn() } }));
vi.mock('passport-local', () => ({ Strategy: class { constructor(_options, verify) { mocks.local = verify; } } }));
vi.mock('passport-google-oauth20', () => ({ Strategy: class {} }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('dummy-hash'), compare: mocks.compare } }));
vi.mock('../oauthState.js', () => ({ oauthStateStore: {} }));
vi.mock('../../config/mongodb.js', () => ({ getUsersCollection: vi.fn() }));

const { initPassport } = await import('../passport.js');
initPassport();
beforeEach(() => { vi.clearAllMocks(); mocks.compare.mockResolvedValue(true); });

async function authenticate(user, valid = true) {
  mocks.find.mockResolvedValue(user);
  mocks.compare.mockResolvedValue(valid);
  const done = vi.fn();
  await mocks.local('alice@example.test', 'password', done);
  return done;
}

it('blocks a correct password for an explicitly unverified local user', async () => {
  const done = await authenticate({ authProvider: 'local', emailVerified: false, passwordHash: 'hash' });
  expect(mocks.compare).toHaveBeenCalledWith('password', 'hash');
  expect(done).toHaveBeenCalledWith(null, false, { message: 'Please verify your email before signing in', code: 'EMAIL_NOT_VERIFIED' });
});

it.each([true, undefined])('allows local users with verification field %s', async (emailVerified) => {
  const user = { id: 'alice', authProvider: 'local', emailVerified, passwordHash: 'hash' };
  const done = await authenticate(user);
  expect(done).toHaveBeenCalledWith(null, user);
});

it.each([
  [{ authProvider: 'local', emailVerified: false, passwordHash: 'hash' }, false],
  [{ authProvider: 'google', emailVerified: true, passwordHash: 'hash' }, true],
  [null, false],
])('keeps invalid credentials generic for %j', async (user, valid) => {
  const done = await authenticate(user, valid);
  expect(done).toHaveBeenCalledWith(null, false, { message: 'Invalid email or password' });
});
