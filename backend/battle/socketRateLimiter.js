const buckets = new Map();
export function allowSocketAction({ userId, action, limit, windowMs }) { const key = `${userId}:${action}`, now = Date.now(), current = buckets.get(key); if (!current || now - current.startedAt >= windowMs) { buckets.set(key, { startedAt: now, count: 1 }); return true; } if (current.count >= limit) return false; current.count++; return true; }
