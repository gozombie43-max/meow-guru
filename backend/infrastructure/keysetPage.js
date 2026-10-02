import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';

// Compound date/_id ordering stays deterministic when timestamps are equal.
export async function readKeysetPage(collection, { filter = {}, scope, field = 'createdAt', cursor, limit = 20, includeTotal = false, projection } = {}) {
  const size = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 20));
  if (typeof scope !== 'string' || !scope) throw new Error('A stable cursor scope is required');
  const fingerprint = createHash('sha256').update(JSON.stringify([scope, field])).digest('hex').slice(0, 24);
  let match = filter;
  if (cursor) {
    let boundary;
    try {
      if (typeof cursor !== 'string' || cursor.length > 1024) throw new Error();
      boundary = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (boundary.v !== 1 || boundary.f !== fingerprint || !/^[a-fA-F0-9]{24}$/.test(boundary.id) || !Number.isFinite(Date.parse(boundary.at))) throw new Error();
    } catch { throw Object.assign(new Error('Invalid pagination cursor'), { statusCode: 400 }); }
    const date = new Date(boundary.at);
    match = { $and: [filter, { $or: [{ [field]: { $lt: date } }, { [field]: date, _id: { $lt: new ObjectId(boundary.id) } }] }] };
  }
  const rows = await collection.find(match, { ...(projection ? { projection } : {}), maxTimeMS: 5000 }).sort({ [field]: -1, _id: -1 }).limit(size + 1).toArray();
  const items = rows.slice(0, size), hasMore = rows.length > size, last = items.at(-1);
  const nextCursor = hasMore ? Buffer.from(JSON.stringify({ v: 1, f: fingerprint, at: new Date(last[field]).toISOString(), id: last._id.toString() })).toString('base64url') : null;
  const total = includeTotal ? await collection.countDocuments(filter, { maxTimeMS: 5000 }) : undefined;
  return { items, hasMore, nextCursor, ...(total === undefined ? {} : { total }) };
}
