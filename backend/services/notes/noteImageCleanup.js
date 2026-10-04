import { claimNoteImageCleanup, isNoteImageReferenced, finishNoteImageCleanup, deferNoteImageCleanup } from '../../repositories/noteImageRepository.js';
import { purgeObjectVersions, listNoteImageObjects } from '../../infrastructure/objectStorage.js';
import { logger } from '../../infrastructure/logger.js';
import { isNoteImageKey } from './imageKeys.js';
import { noteImageInventoryCursor, saveNoteImageInventoryCursor, trackLegacyNoteImage } from '../../repositories/noteImageRepository.js';

async function inventoryLegacyImages(now) {
  const cursor = await noteImageInventoryCursor();
  const page = await listNoteImageObjects(cursor?.token || undefined);
  for (const object of page.Contents || []) {
    if (isNoteImageKey(object.Key) && object.LastModified && +object.LastModified <= +now - 48 * 3600000) await trackLegacyNoteImage(object.Key, now);
  }
  await saveNoteImageInventoryCursor(page.NextContinuationToken);
}

export async function cleanupNoteImages(now = new Date()) {
  // Inventory is bounded and includes uploads predating the registry.
  try { await inventoryLegacyImages(now); }
  catch (error) { logger.warn({ err: error }, 'note image inventory will retry'); }
  let removed = 0;
  for (let count = 0; count < 50; count++) {
    const row = await claimNoteImageCleanup(now);
    if (!row) break;
    try {
      if (!isNoteImageKey(row._id)) throw new Error('Invalid note image cleanup key');
      if (await isNoteImageReferenced(row._id)) {
        await deferNoteImageCleanup(row, true, now);
        continue;
      }
      await purgeObjectVersions(row._id);
      await finishNoteImageCleanup(row);
      removed++;
    } catch (error) {
      await deferNoteImageCleanup(row, false, now);
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
