import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';

// Compound date/_id ordering stays deterministic when timestamps are equal.
export async function readKeysetPage(collection, { filter = {}, filterScope = filter, scope, field = 'createdAt', direction = -1, cursor, limit = 20, includeTotal = false, projection } = {}) {
  const size = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 20));
  if (typeof scope !== 'string' || !scope) throw new Error('A stable cursor scope is required');
  if (![1, -1].includes(direction)) throw new Error('Invalid sort direction');
  const fingerprint = createHash('sha256').update(JSON.stringify([scope, field, direction, filterScope], (key, value) => {
    if (key === 'expiresAt') return undefined;
    if (value instanceof RegExp) return { regex: value.source, flags: value.flags };
    return value;
  })).digest('hex').slice(0, 24);
  let match = filter;
  if (cursor) {
    let boundary;
    try {
      if (typeof cursor !== 'string' || cursor.length > 1024) throw new Error();
      boundary = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (boundary.v !== 2 || boundary.f !== fingerprint || !/^[a-fA-F0-9]{24}$/.test(boundary.id) || !['date', 'string', 'number', 'null'].includes(boundary.type)) throw new Error();
      if (boundary.type === 'date' && !Number.isFinite(Date.parse(boundary.at))) throw new Error();
      if (boundary.type === 'string' && (typeof boundary.at !== 'string' || boundary.at.length > 512)) throw new Error();
      if (boundary.type === 'number' && !Number.isFinite(boundary.at)) throw new Error();
      if (boundary.type === 'null' && boundary.at !== null) throw new Error();
    } catch { throw Object.assign(new Error('Invalid pagination cursor'), { statusCode: 400 }); }
    const date = boundary.type === 'date' ? new Date(boundary.at) : boundary.at;
    const operator = direction === -1 ? '$lt' : '$gt';
    match = { $and: [filter, { $or: [{ [field]: { [operator]: date } }, { [field]: date, _id: { [operator]: new ObjectId(boundary.id) } }] }] };
  }
  const queryProjection = projection ? { ...projection } : undefined;
  if (queryProjection?._id === 0) delete queryProjection._id;
  const rows = await collection.find(match, { ...(queryProjection ? { projection: queryProjection } : {}), maxTimeMS: 5000 }).sort({ [field]: direction, _id: direction }).limit(size + 1).toArray();
  const items = rows.slice(0, size), hasMore = rows.length > size, last = items.at(-1);
  const nextCursor = hasMore ? Buffer.from(JSON.stringify({ v: 2, f: fingerprint, type: last[field] instanceof Date ? 'date' : last[field] == null ? 'null' : typeof last[field], at: last[field] instanceof Date ? last[field].toISOString() : last[field] ?? null, id: last._id.toString() })).toString('base64url') : null;
  const total = includeTotal ? await collection.countDocuments(filter, { maxTimeMS: 5000 }) : undefined;
  return { items, hasMore, nextCursor, ...(total === undefined ? {} : { total }) };
}

export function boundedLegacyOffset(page, limit) {
  const offset = Math.max(0, (Math.floor(Number(page) || 1) - 1) * limit);
  if (offset > 1000) throw Object.assign(new Error('Deep offsets are retired. Use pagination=cursor and nextCursor.'), { statusCode: 400, code: 'CURSOR_REQUIRED' });
  return offset;
}
