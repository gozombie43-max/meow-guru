import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as authEmailSecurity from '../021-auth-email-security.js';
import * as productionHardening from '../003-production-hardening.js';
import { ensureRegistrationLockExpiry } from '../registrationLockExpiry.js';
import { migrate, migrations } from '../runner.js';

let mongo, client, db;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = await new MongoClient(mongo.getUri()).connect();
  db = client.db('auth_email_security_indexes');
}, 60000);
beforeEach(async () => { await db.dropDatabase(); });
afterAll(async () => { await client?.close(); await mongo?.stop(); });

it('registers 021 and creates partial token lookups without TTL indexes on users', async () => {
  expect(migrations.some(migration => migration.id === authEmailSecurity.id)).toBe(true);
  await db.collection('users').createIndex({ emailNormalized: 1 }, {
    name: 'account_email_identity', unique: true,
    partialFilterExpression: { accountRecord: true, emailNormalized: { $type: 'string' } },
  });
  await db.collection('users').insertMany([
    { id: 'verification', emailVerificationTokenHash: 'verify-hash', emailVerificationExpiresAt: new Date(0) },
    { id: 'reset', passwordResetTokenHash: 'reset-hash', passwordResetExpiresAt: new Date(0) },
    { id: 'ordinary' },
  ]);
  await authEmailSecurity.up(db);
  const indexes = await db.collection('users').listIndexes().toArray();
  expect(indexes.find(index => index.name === 'account_email_identity').unique).toBe(true);
  expect(indexes.find(index => index.name === 'email_verification_token_lookup')).toMatchObject({
    key: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
    partialFilterExpression: { emailVerificationTokenHash: { $type: 'string' } },
  });
  expect(indexes.find(index => index.name === 'password_reset_token_lookup')).toMatchObject({
    key: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    partialFilterExpression: { passwordResetTokenHash: { $type: 'string' } },
  });
  expect(indexes.filter(index => index.expireAfterSeconds !== undefined)).toEqual([]);
  expect(await db.collection('users').countDocuments({})).toBe(3);
  expect((await db.collection('registrationLocks').listIndexes().toArray()).find(index => index.name === 'registration_lock_expiry'))
    .toMatchObject({ key: { createdAt: 1 }, expireAfterSeconds: 600 });
});

it('upgrades the existing 900-second TTL and survives old/new migration replay', async () => {
  await db.collection('registrationLocks').createIndex({ createdAt: 1 }, { name: 'registration_lock_expiry', expireAfterSeconds: 900 });
  const steps = [productionHardening, authEmailSecurity];
  await migrate(db, steps);
  await migrate(db, steps);
  expect(await db.collection('schemaMigrations').countDocuments({ completedAt: { $type: 'date' } })).toBe(2);
  expect(await db.collection('schemaMigrationLocks').countDocuments({})).toBe(0);
  expect((await db.collection('registrationLocks').listIndexes().toArray()).find(index => index.name === 'registration_lock_expiry').expireAfterSeconds).toBe(600);
});

it.each([
  { code: 13, existing: null },
  { code: 85, existing: { name: 'registration_lock_expiry', key: { different: 1 }, expireAfterSeconds: 900 } },
  { code: 85, existing: { name: 'registration_lock_expiry', key: { createdAt: 1 }, unique: true, expireAfterSeconds: 900 } },
])('surfaces unrelated index errors without modifying indexes: %j', async ({ code, existing }) => {
  const error = Object.assign(new Error('Index error'), { code });
  const command = vi.fn();
  const fakeDb = { command, collection: () => ({
    createIndex: vi.fn().mockRejectedValue(error), listIndexes: () => ({ toArray: async () => existing ? [existing] : [] }),
  }) };
  await expect(ensureRegistrationLockExpiry(fakeDb)).rejects.toBe(error);
  expect(command).not.toHaveBeenCalled();
});
