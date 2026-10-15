// The runner replays old migrations, so both 003 and 021 must agree on this TTL.
export async function ensureRegistrationLockExpiry(db) {
  const locks = db.collection('registrationLocks');
  const name = 'registration_lock_expiry';
  try {
    await locks.createIndex({ createdAt: 1 }, { name, expireAfterSeconds: 600 });
  } catch (error) {
    if (error.code !== 85) throw error; // IndexOptionsConflict.
    const existing = (await locks.listIndexes().toArray()).find(index => index.name === name);
    // Only reconcile the known TTL definition; surface unrelated index conflicts.
    if (!existing || Object.keys(existing.key).length !== 1 || existing.key.createdAt !== 1 ||
        !Number.isFinite(existing.expireAfterSeconds) || existing.unique || existing.sparse || existing.partialFilterExpression) {
      throw error;
    }
    await db.command({ collMod: 'registrationLocks', index: { name, expireAfterSeconds: 600 } });
  }
}
