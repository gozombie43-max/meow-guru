import { BSON } from 'mongodb';
import { redisCacheOversized, redisCacheValueBytes } from './metrics.js';

export const JSON_CACHE_MAX_BYTES = 512 * 1024;
export const EJSON_CACHE_MAX_BYTES = 2 * 1024 * 1024;

// Stop walking large strings/arrays before allocating a full serialized copy.
// The final UTF-8 check also accounts for escaping and EJSON expansion.
function fitsPreflight(value, maxBytes) {
  const seen = new WeakSet(), stack = [value];
  let bytes = 0, nodes = 0;
  while (stack.length) {
    const item = stack.pop();
    if (++nodes > 100000) return false;
    if (typeof item === 'string') bytes += Buffer.byteLength(item);
    else if (item && typeof item === 'object' && !seen.has(item)) {
      seen.add(item);
      if (ArrayBuffer.isView(item)) bytes += item.byteLength;
      else if (Array.isArray(item)) {
        if (item.length > 100000 - nodes) return false;
        for (const child of item) stack.push(child);
      } else {
        const keys = Object.keys(item);
        if (keys.length > 100000 - nodes) return false;
        for (const key of keys) { bytes += Buffer.byteLength(key); stack.push(item[key]); }
      }
    }
    if (bytes > maxBytes || stack.length > 100000) return false;
  }
  return true;
}

export function encodeCacheValue(value, format = 'json', maxBytes = format === 'ejson' ? EJSON_CACHE_MAX_BYTES : JSON_CACHE_MAX_BYTES) {
  try {
    if (!fitsPreflight(value, maxBytes)) { redisCacheOversized.inc({ format }); return null; }
    const encoded = format === 'ejson' ? BSON.EJSON.stringify(value) : JSON.stringify(value);
    if (typeof encoded !== 'string') return null;
    const bytes = Buffer.byteLength(encoded);
    redisCacheValueBytes.observe({ format }, bytes);
    if (bytes > maxBytes) { redisCacheOversized.inc({ format }); return null; }
    return { encoded, bytes };
  } catch { return null; /* Serialization must never break a source read. */ }
}
