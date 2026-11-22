import { getMongoDB } from '../config/mongodb.js';
import { assertMigrations } from '../migrations/runner.js';

export const READINESS_CACHE_TTL_MS = 3_000;
export const MIGRATIONS_CACHE_TTL_MS = 60_000;

let cachedDb = null;
let readinessValidUntil = 0;
let migrationsValidUntil = 0;
let inFlightReadiness = null;

function getReadinessCacheTtlMs() {
  const raw = process.env.READINESS_CACHE_TTL_MS;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return READINESS_CACHE_TTL_MS;
  }
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 30_000) : READINESS_CACHE_TTL_MS;
}

export function resetReadinessCache() {
  cachedDb = null;
  readinessValidUntil = 0;
  migrationsValidUntil = 0;
  inFlightReadiness = null;
}

export async function checkReadiness({ force = false } = {}) {
  const db = getMongoDB();
  if (db !== cachedDb) {
    cachedDb = db;
    readinessValidUntil = 0;
    migrationsValidUntil = 0;
    inFlightReadiness = null;
  }

  const now = Date.now();
  const ttlMs = getReadinessCacheTtlMs();
  if (!force && ttlMs > 0 && now < readinessValidUntil && now < migrationsValidUntil) {
    return;
  }

  if (!force && inFlightReadiness) {
    return inFlightReadiness;
  }

  const probe = (async () => {
    try {
      await db.command({ ping: 1 }, { timeoutMS: 2000 });
      const checkTime = Date.now();
      if (force || checkTime >= migrationsValidUntil) {
        await assertMigrations(db);
        migrationsValidUntil = Date.now() + MIGRATIONS_CACHE_TTL_MS;
      }
      readinessValidUntil = Date.now() + getReadinessCacheTtlMs();
    } catch (error) {
      readinessValidUntil = 0;
      migrationsValidUntil = 0;
      throw error;
    }
  })();

  let runProbe;
  runProbe = probe.finally(() => {
    if (inFlightReadiness === runProbe) {
      inFlightReadiness = null;
    }
  });

  if (!force) {
    inFlightReadiness = runProbe;
  }
  return runProbe;
}
