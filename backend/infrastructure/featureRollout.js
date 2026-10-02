import { createHash } from 'node:crypto';

// Stable per-user cohorts. An explicit false always overrides percentages.
export function featureEnabled(name, identity = '', defaultValue = false) {
  const configured = process.env[name];
  if (configured === 'false') return false;
  const percentage = process.env[`${name}_PERCENT`];
  if (percentage !== undefined) {
    const value = Number(percentage);
    if (!Number.isFinite(value) || value < 0 || value > 100 || !identity) return false;
    const bucket = createHash('sha256').update(`${name}:${identity}`).digest().readUInt32BE(0) % 10000;
    return bucket < value * 100;
  }
  return configured === 'true' || (configured === undefined && defaultValue);
}
