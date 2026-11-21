import { readFileSync } from 'node:fs';

let cachedReleaseId;

function readReleaseId() {
  try {
    const raw = readFileSync(new URL('../RELEASE_ID', import.meta.url), 'utf8').trim();
    if (raw) {
      return raw;
    }
  } catch {
    // Packaged RELEASE_ID file not present; fall back to environment variable or local default.
  }

  return process.env.RELEASE_ID || 'local';
}

export function getReleaseId() {
  if (cachedReleaseId === undefined) {
    cachedReleaseId = readReleaseId();
  }

  return cachedReleaseId;
}

export function _resetCachedReleaseId() {
  cachedReleaseId = undefined;
}

// Snapshot the release identifier at module load so in-place deployments
// (such as Azure OneDeploy) overwriting backend/RELEASE_ID cannot cause an
// already-running process to falsely report the incoming release ID.
cachedReleaseId = readReleaseId();
