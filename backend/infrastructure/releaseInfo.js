import { readFileSync } from 'node:fs';

let cachedReleaseId;

export function getReleaseId() {
  if (cachedReleaseId !== undefined) {
    return cachedReleaseId;
  }

  try {
    const raw = readFileSync(new URL('../RELEASE_ID', import.meta.url), 'utf8').trim();
    if (raw) {
      cachedReleaseId = raw;
      return cachedReleaseId;
    }
  } catch {
    // Packaged RELEASE_ID file not present; fall back to environment variable or local default.
  }

  cachedReleaseId = process.env.RELEASE_ID || 'local';
  return cachedReleaseId;
}

export function _resetCachedReleaseId() {
  cachedReleaseId = undefined;
}
