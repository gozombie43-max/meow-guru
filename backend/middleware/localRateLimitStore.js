// Bounded outage protection. Never evict a live key to admit an attacker key.
export class LocalRateLimitStore {
  constructor({ maxKeys = 10000, now = Date.now } = {}) {
    this.entries = new Map();
    this.maxKeys = maxKeys;
    this.now = now;
  }
  init({ windowMs }) { this.windowMs = windowMs; }
  increment(key) {
    const now = this.now();
    let entry = this.entries.get(key);
    if (entry?.resetTime.getTime() <= now) { this.entries.delete(key); entry = undefined; }
    if (!entry) {
      if (this.entries.size >= this.maxKeys) {
        for (const [id, row] of this.entries) if (row.resetTime.getTime() <= now) this.entries.delete(id);
      }
      if (this.entries.size >= this.maxKeys) return { totalHits: Number.MAX_SAFE_INTEGER, resetTime: new Date(now + this.windowMs) };
      entry = { totalHits: 0, resetTime: new Date(now + this.windowMs) };
      this.entries.set(key, entry);
    }
    entry.totalHits++;
    return { ...entry };
  }
  observe(key, result) {
    const entry = this.entries.get(key);
    if (entry) {
      entry.totalHits = Math.max(entry.totalHits, result.totalHits);
      entry.resetTime = new Date(Math.max(entry.resetTime.getTime(), result.resetTime.getTime()));
    }
  }
  decrement(key) { const entry = this.entries.get(key); if (entry) entry.totalHits = Math.max(0, entry.totalHits - 1); }
  resetKey(key) { this.entries.delete(key); }
}
