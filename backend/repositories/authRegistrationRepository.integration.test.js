import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB, getUsersCollection } from '../config/mongodb.js';
import { findUserByEmail, verifyLocalUserEmailByTokenHash, replaceEmailVerificationToken, issuePasswordResetToken, consumePasswordResetToken } from './authRegistrationRepository.js';

let mongo;
const now = new Date('2026-10-15T12:00:00Z');
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'email_verification_test');
  await connectMongoDB();
}, 60000);
beforeEach(async () => { await getUsersCollection().deleteMany({}); });
afterAll(async () => {
  await disconnectMongoDB();
  await mongo?.stop();
  vi.unstubAllEnvs();
});

const insert = (overrides = {}) => getUsersCollection().insertOne({
  id: 'user-test', authProvider: 'local', emailVerified: false,
  emailVerificationTokenHash: 'stored-hash',
  emailVerificationExpiresAt: new Date(now.getTime() + 60000), ...overrides,
});

it('atomically consumes a token once under concurrent verification and removes temporary fields', async () => {
  await insert();
  const results = await Promise.all(Array.from({ length: 8 }, () => verifyLocalUserEmailByTokenHash('stored-hash', now)));
  expect(results.reduce((total, result) => total + result.modifiedCount, 0)).toBe(1);
  const user = await getUsersCollection().findOne({ id: 'user-test' });
  expect(user.emailVerified).toBe(true);
  expect(user.emailVerifiedAt).toEqual(now);
  expect(user).not.toHaveProperty('emailVerificationTokenHash');
  expect(user).not.toHaveProperty('emailVerificationExpiresAt');
  expect((await verifyLocalUserEmailByTokenHash('stored-hash', now)).modifiedCount).toBe(0);
});

it.each([
  { emailVerificationExpiresAt: new Date(now.getTime() - 1) },
  { emailVerificationExpiresAt: now },
  { authProvider: 'google' },
  { authProvider: 'firebase' },
  { emailVerified: true },
  { emailVerificationTokenHash: 'different-hash' },
])('does not modify an ineligible account: %j', async (overrides) => {
  await insert(overrides);
  const before = await getUsersCollection().findOne({ id: 'user-test' });
  expect((await verifyLocalUserEmailByTokenHash('stored-hash', now)).modifiedCount).toBe(0);
  expect(await getUsersCollection().findOne({ id: 'user-test' })).toEqual(before);
});

it('rejects an unknown token without changing any account', async () => {
  expect((await verifyLocalUserEmailByTokenHash('unknown', now)).modifiedCount).toBe(0);
});

it('loads verification status for authentication without exposing temporary token fields', async () => {
  await insert({ email: 'alice@example.test', emailVerified: true, emailVerifiedAt: now });
  const user = await findUserByEmail('alice@example.test');
  expect(user.emailVerified).toBe(true);
  expect(user.emailVerifiedAt).toEqual(now);
  expect(user).not.toHaveProperty('emailVerificationTokenHash');
  expect(user).not.toHaveProperty('emailVerificationExpiresAt');
});

const rotate = (offset = 0) => replaceEmailVerificationToken({
  email: ' Alice@Example.test ', tokenHash: 'new-hash',
  expiresAt: new Date(now.getTime() + 1800000), now: new Date(now.getTime() + offset),
});

it('allows one concurrent rotation, blocks resends until 60 seconds, and invalidates the old token', async () => {
  await insert({ email: 'alice@example.test', emailNormalized: 'alice@example.test', name: 'Alice' });
  const results = await Promise.all(Array.from({ length: 8 }, () => rotate()));
  expect(results.filter(Boolean)).toEqual([{ id: 'user-test', name: 'Alice', email: 'alice@example.test' }]);
  expect(await rotate(59999)).toBeNull();
  expect((await verifyLocalUserEmailByTokenHash('stored-hash', now)).modifiedCount).toBe(0);
  const stored = await getUsersCollection().findOne({ id: 'user-test' });
  expect(stored.emailVerificationTokenHash).toBe('new-hash');
  expect(stored.emailVerificationExpiresAt).toEqual(new Date(now.getTime() + 1800000));
  expect(stored.emailVerificationLastSentAt).toEqual(now);
  expect(await rotate(60000)).not.toBeNull();
  expect((await verifyLocalUserEmailByTokenHash('new-hash', new Date(now.getTime() + 60000))).modifiedCount).toBe(1);
  expect(await rotate(120000)).toBeNull();
});

it.each([
  { authProvider: 'google' }, { authProvider: 'firebase' }, { emailVerified: true },
  { emailVerificationLastSentAt: now },
])('does not rotate an ineligible account: %j', async (overrides) => {
  await insert({ email: 'alice@example.test', emailNormalized: 'alice@example.test', ...overrides });
  const before = await getUsersCollection().findOne({ id: 'user-test' });
  expect(await rotate()).toBeNull();
  expect(await getUsersCollection().findOne({ id: 'user-test' })).toEqual(before);
});

it('does not rotate an unknown email', async () => {
  expect(await rotate()).toBeNull();
});

const issueReset = (tokenHash = 'reset-hash', offset = 0) => issuePasswordResetToken({
  email: ' Alice@Example.test ', tokenHash, expiresAt: new Date(now.getTime() + 900000),
  now: new Date(now.getTime() + offset),
});
const consumeReset = (tokenHash = 'reset-hash', time = now) => consumePasswordResetToken({ tokenHash, passwordHash: 'new-password-hash', now: time });

it('atomically enforces reset cooldown and invalidates the previous hash on reissue', async () => {
  await insert({ email: 'alice@example.test', emailNormalized: 'alice@example.test' });
  const results = await Promise.all(Array.from({ length: 8 }, () => issueReset()));
  expect(results.filter(Boolean)).toEqual([{ id: 'user-test', email: 'alice@example.test' }]);
  expect(await issueReset('blocked', 59999)).toBeNull();
  expect(await issueReset('replacement', 60000)).not.toBeNull();
  expect(await consumeReset()).toBeNull();
  expect(await consumeReset('replacement', new Date(now.getTime() + 60000))).not.toBeNull();
});

it('consumes a reset token once under races and removes only reset fields', async () => {
  await insert({ email: 'alice@example.test', emailNormalized: 'alice@example.test' });
  await issueReset();
  const results = await Promise.all(Array.from({ length: 8 }, () => consumeReset()));
  expect(results.filter(Boolean)).toEqual([{ id: 'user-test', email: 'alice@example.test' }]);
  const user = await getUsersCollection().findOne({ id: 'user-test' });
  expect(user.passwordHash).toBe('new-password-hash');
  expect(user.passwordChangedAt).toEqual(now);
  expect(user.emailVerified).toBe(false);
  expect(user.emailVerificationTokenHash).toBe('stored-hash');
  for (const key of ['passwordResetTokenHash', 'passwordResetExpiresAt', 'passwordResetLastSentAt']) expect(user).not.toHaveProperty(key);
  expect(await consumeReset()).toBeNull();
});

it.each(['google', 'firebase'])('does not issue a password reset for %s accounts', async authProvider => {
  await insert({ email: 'alice@example.test', emailNormalized: 'alice@example.test', authProvider });
  expect(await issueReset()).toBeNull();
});

it.each([
  { passwordResetExpiresAt: now }, { passwordResetExpiresAt: new Date(now.getTime() - 1) },
  { authProvider: 'google' }, { authProvider: 'firebase' }, { passwordResetTokenHash: 'other-hash' },
])('does not consume an ineligible reset: %j', async overrides => {
  await insert({ passwordHash: 'old-password-hash', passwordResetTokenHash: 'reset-hash',
    passwordResetExpiresAt: new Date(now.getTime() + 900000), ...overrides });
  const before = await getUsersCollection().findOne({ id: 'user-test' });
  expect(await consumeReset()).toBeNull();
  expect(await getUsersCollection().findOne({ id: 'user-test' })).toEqual(before);
});

it('does not issue or consume tokens for an unknown account', async () => {
  expect(await issueReset()).toBeNull();
  expect(await consumeReset()).toBeNull();
});

it('keeps reset credentials out of authentication projections', async () => {
  await insert({ email: 'alice@example.test', emailNormalized: 'alice@example.test' });
  await issueReset();
  const user = await findUserByEmail('alice@example.test');
  expect(user).not.toHaveProperty('passwordResetTokenHash');
  expect(user).not.toHaveProperty('passwordResetExpiresAt');
});
