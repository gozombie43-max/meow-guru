import { claimNoteImageCleanup, isNoteImageReferenced, finishNoteImageCleanup, deferNoteImageCleanup } from '../../repositories/noteImageRepository.js';
import { purgeObjectVersions, listNoteImageObjects } from '../../infrastructure/objectStorage.js';
import { logger } from '../../infrastructure/logger.js';
import { isNoteImageKey } from './imageKeys.js';
import { noteImageInventoryCursor, saveNoteImageInventoryCursor, trackLegacyNoteImage } from '../../repositories/noteImageRepository.js';

const inventoryIntervalMs = () => {
  const raw = process.env.NOTE_IMAGE_INVENTORY_INTERVAL_MS;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return 24 * 60 * 60 * 1000;
  const configured = Number(raw);
  return Number.isFinite(configured) && configured > 0 ? configured : 24 * 60 * 60 * 1000;
};

const isInventoryDisabled = () => {
  const raw = process.env.NOTE_IMAGE_INVENTORY_ENABLED;
  if (raw === false || raw === 0) return true;
  if (typeof raw !== 'string') return false;
  const val = raw.trim().toLowerCase();
  return val === 'false' || val === '0' || val === 'off' || val === 'no';
};

const isInvalidContinuationTokenError = (error) => {
  if (!error) return false;
  const candidates = [error, error.cause].filter(Boolean);
  for (const err of candidates) {
    if (err.name === 'InvalidContinuationToken' || err.Code === 'InvalidContinuationToken' || err.code === 'InvalidContinuationToken') {
      return true;
    }
    const message = (typeof err.message === 'string' ? err.message : String(err)).toLowerCase();
    if (message.includes('continuation token') || message.includes('continuationtoken')) {
      return true;
    }
  }
  return false;
};

async function inventoryLegacyImages(now) {
  if (isInventoryDisabled()) return;
  const cursor = await noteImageInventoryCursor();
  const interval = inventoryIntervalMs();
  if (!cursor?.token && cursor?.completedAt) {
    const completedAtMs = new Date(cursor.completedAt).getTime();
    if (Number.isFinite(completedAtMs) && (+now - completedAtMs < interval)) {
      return;
    }
  }
  const page = await listNoteImageObjects(cursor?.token || undefined);
  for (const object of page?.Contents || []) {
    const lastModifiedMs = new Date(object.LastModified).getTime();
    if (isNoteImageKey(object.Key) && Number.isFinite(lastModifiedMs) && lastModifiedMs <= +now - 48 * 3600000) {
      await trackLegacyNoteImage(object.Key, now);
    }
  }
  await saveNoteImageInventoryCursor(page?.NextContinuationToken, page?.NextContinuationToken ? undefined : now);
}

export async function cleanupNoteImages(now = new Date()) {
  const nowDate = (now instanceof Date && Number.isFinite(now.getTime()))
    ? now
    : new Date(Number.isFinite(Number(now)) && Number(now) > 0 ? Number(now) : Date.now());
  // Inventory is bounded and includes uploads predating the registry.
  try {
    await inventoryLegacyImages(nowDate);
  } catch (error) {
    if (isInvalidContinuationTokenError(error)) {
      logger.warn({ err: error }, 'invalid B2 continuation token; resetting inventory cursor');
      await saveNoteImageInventoryCursor(null, { reset: true }).catch(() => {});
    } else {
      logger.warn({ err: error }, 'note image inventory will retry');
    }
  }
  let removed = 0;
  for (let count = 0; count < 50; count++) {
    const row = await claimNoteImageCleanup(nowDate);
    if (!row) break;
    try {
      if (!isNoteImageKey(row._id)) throw new Error('Invalid note image cleanup key');
      if (await isNoteImageReferenced(row._id)) {
        await deferNoteImageCleanup(row, true, nowDate);
        continue;
      }
      await purgeObjectVersions(row._id);
      await finishNoteImageCleanup(row);
      removed++;
    } catch (error) {
      await deferNoteImageCleanup(row, false, nowDate);
      logger.warn({ err: error }, 'note image cleanup will retry');
    }
  }
  return removed;
}

let timer, running;
export function startNoteImageCleanup() {
  if (timer) return;
  const tick = () => {
    if (!running) running = cleanupNoteImages().catch(error => logger.error({ err: error }, 'note image cleanup failed')).finally(() => { running = undefined; });
  };
  timer = setInterval(tick, 60_000);
  timer.unref();
  tick();
}
export function stopNoteImageCleanup() { clearInterval(timer); timer = undefined; }
export async function waitForNoteImageCleanupIdle() { await running; return true; }
