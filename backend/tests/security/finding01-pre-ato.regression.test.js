import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { resolveEmailOtpAccount } from '../../services/email/emailOtpAccount.js';
import passport, { initPassport } from '../../auth/passport.js';

describe('FINDING-01 Regression: Pre-Account Takeover & Unverified Password Credentials', () => {
  let mongo;
  let db;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', mongo.getUri());
    vi.stubEnv('MONGODB_DB', 'finding01_pre_ato_test');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-google-client-secret');
    vi.stubEnv('GOOGLE_CALLBACK_URL', 'http://localhost:3000/auth/google/callback');
    db = await connectMongoDB();
    initPassport();
  }, 60000);

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
  });

  afterAll(async () => {
    await disconnectMongoDB();
    await mongo?.stop();
    vi.unstubAllEnvs();
  });

  const runLocalStrategy = (email, password) =>
    new Promise((resolve, reject) => {
      const strategy = passport._strategy('local');
      strategy._verify(email, password, (err, user, info) => {
        if (err) return reject(err);
        resolve({ user, info });
      });
    });

  const runGoogleStrategy = (profile) =>
    new Promise((resolve, reject) => {
      const strategy = passport._strategy('google');
      strategy._verify('access-token', 'refresh-token', profile, (err, user, info) => {
        if (err) return reject(err);
        resolve({ user, info });
      });
    });

  it('strips unverified passwordHash when legitimate owner claims pre-registered email via Email OTP', async () => {
    const email = 'victim@example.test';
    const attackerPassword = 'AttackerChosenPassword123!';
    const attackerHash = await bcrypt.hash(attackerPassword, 12);

    await db.collection('users').insertOne({
      id: 'user-pre-ato-1',
      name: 'Attacker Name',
      email,
      emailNormalized: email,
      accountRecord: true,
      role: 'student',
      authProvider: 'local',
      passwordHash: attackerHash,
      emailVerified: false,
      emailVerificationTokenHash: 'pending-verification-hash',
      emailVerificationExpiresAt: new Date(Date.now() + 600_000),
      passwordResetTokenHash: 'pending-reset-hash',
      passwordResetExpiresAt: new Date(Date.now() + 600_000),
    });

    // Victim proves email ownership via OTP
    const claimedUser = await resolveEmailOtpAccount(email);
    expect(claimedUser).toBeTruthy();
    expect(claimedUser.id).toBe('user-pre-ato-1');
    expect(claimedUser.emailVerified).toBe(true);
    expect(claimedUser).not.toHaveProperty('passwordHash');

    const stored = await db.collection('users').findOne({ id: 'user-pre-ato-1' });
    expect(stored.emailVerified).toBe(true);
    expect(stored).not.toHaveProperty('passwordHash');
    expect(stored).not.toHaveProperty('emailVerificationTokenHash');
    expect(stored).not.toHaveProperty('passwordResetTokenHash');

    // Attacker can no longer sign in with the pre-registered password
    const loginAttempt = await runLocalStrategy(email, attackerPassword);
    expect(loginAttempt.user).toBe(false);
  });

  it('strips unverified passwordHash when legitimate owner claims pre-registered email via Google OAuth', async () => {
    const email = 'google-victim@example.test';
    const attackerPassword = 'AttackerChosenPassword123!';
    const attackerHash = await bcrypt.hash(attackerPassword, 12);

    await db.collection('users').insertOne({
      id: 'user-pre-ato-google',
      name: 'Attacker Name',
      email,
      emailNormalized: email,
      accountRecord: true,
      role: 'student',
      authProvider: 'local',
      passwordHash: attackerHash,
      emailVerified: false,
      emailVerificationTokenHash: 'pending-verification-hash',
      emailVerificationExpiresAt: new Date(Date.now() + 600_000),
    });

    const { user } = await runGoogleStrategy({
      id: 'google-sub-12345',
      displayName: 'Real Victim',
      emails: [{ value: email, verified: true }],
      photos: [{ value: 'https://example.com/avatar.png' }],
    });

    expect(user).toBeTruthy();
    expect(user.id).toBe('user-pre-ato-google');
    expect(user.googleId).toBe('google-sub-12345');
    expect(user.authProvider).toBe('google');
    expect(user.emailVerified).toBe(true);
    expect(user).not.toHaveProperty('passwordHash');

    const stored = await db.collection('users').findOne({ id: 'user-pre-ato-google' });
    expect(stored.authProvider).toBe('google');
    expect(stored.emailVerified).toBe(true);
    expect(stored).not.toHaveProperty('passwordHash');
    expect(stored).not.toHaveProperty('emailVerificationTokenHash');

    // Attacker password login is rejected
    const loginAttempt = await runLocalStrategy(email, attackerPassword);
    expect(loginAttempt.user).toBe(false);
  });

  it('preserves verified passwordHash and role when an already-verified local user signs in via OTP or Google', async () => {
    const email = 'verified-admin@example.test';
    const validPassword = 'VerifiedAdminPassword123!';
    const validHash = await bcrypt.hash(validPassword, 12);

    await db.collection('users').insertOne({
      id: 'user-verified-admin',
      name: 'Verified Admin',
      email,
      emailNormalized: email,
      accountRecord: true,
      role: 'admin',
      authProvider: 'local',
      passwordHash: validHash,
      emailVerified: true,
    });

    const otpClaimed = await resolveEmailOtpAccount(email);
    expect(otpClaimed.id).toBe('user-verified-admin');
    expect(otpClaimed.role).toBe('admin');

    const { user: googleLinked } = await runGoogleStrategy({
      id: 'google-admin-sub',
      displayName: 'Verified Admin',
      emails: [{ value: email, verified: true }],
      photos: [],
    });
    expect(googleLinked.id).toBe('user-verified-admin');
    expect(googleLinked.googleId).toBe('google-admin-sub');

    const stored = await db.collection('users').findOne({ id: 'user-verified-admin' });
    expect(stored.passwordHash).toBe(validHash);
    expect(stored.role).toBe('admin');

    // Verified password still works
    const loginAttempt = await runLocalStrategy(email, validPassword);
    expect(loginAttempt.user).toMatchObject({ id: 'user-verified-admin', role: 'admin' });
  });

  it('rejects dummyPasswordHash plaintext login against passwordless OTP-only accounts', async () => {
    const email = 'otp-only@example.test';
    const otpUser = await resolveEmailOtpAccount(email);
    expect(otpUser.emailVerified).toBe(true);

    // Must not match the fallback dummyPasswordHash ('invalid-account-password')
    const loginAttempt = await runLocalStrategy(email, 'invalid-account-password');
    expect(loginAttempt.user).toBe(false);
  });

  it('rejects Google OAuth login when account is already linked to a different googleId', async () => {
    const email = 'linked@example.test';
    await db.collection('users').insertOne({
      id: 'user-linked',
      name: 'Linked User',
      email,
      emailNormalized: email,
      accountRecord: true,
      role: 'user',
      authProvider: 'google',
      googleId: 'original-google-sub',
      emailVerified: true,
    });

    await expect(
      runGoogleStrategy({
        id: 'different-google-sub',
        displayName: 'Different Google User',
        emails: [{ value: email, verified: true }],
        photos: [],
      }),
    ).rejects.toThrow(/Google account does not match linked identity/);
  });
});
