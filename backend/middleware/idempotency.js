import { createHash } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';

const hash = value => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

// No lease stealing: a crash after the business commit must never run it again.
// An unresolved record returns 409 until reconciled or its 24-hour retention ends.
export function idempotency(operation) {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    if (!key) return next();
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) return res.status(400).json({ error: 'Invalid Idempotency-Key' });
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (req.is('multipart/form-data')) return res.status(400).json({ error: 'Use the upload-specific idempotency protocol' });
    const collection = getMongoDB().collection('idempotencyRecords');
    const scope = `${userId}:${operation}:${req.method}:${req.originalUrl.split('?')[0]}`;
    const id = hash(`${scope}:${key}`);
    const fingerprint = hash(JSON.stringify(canonical({ body: req.body ?? {}, query: req.query ?? {} })));
    try {
      await collection.insertOne({ _id: id, fingerprint, status: 'pending', createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) });
    } catch (error) {
      if (error.code !== 11000) return next(error);
      try {
        const record = await collection.findOne({ _id: id });
        if (record?.fingerprint !== fingerprint) return res.status(409).json({ error: 'Idempotency key was used with different input' });
        if (record.status !== 'completed') return res.set('Retry-After', '3').status(409).json({ error: 'Request outcome is pending reconciliation', code: 'IDEMPOTENCY_PENDING' });
        return res.set('Idempotency-Replayed', 'true').status(record.responseStatus).json(record.response);
      } catch (readError) { return next(readError); }
    }
    const send = res.json.bind(res);
    let saving = false;
    res.json = body => {
      if (saving) return res;
      saving = true;
      const responseStatus = res.statusCode;
      void (async () => {
        try {
          if (Buffer.byteLength(JSON.stringify(body)) > 1024 * 1024) throw new Error('Response exceeds idempotency storage budget');
          await collection.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'completed', responseStatus, response: body, completedAt: new Date() } });
          send(body);
        } catch {
          // Keep the pending record. The mutation may already have committed.
          res.status(503).set('Retry-After', '3');
          send({ error: 'Request outcome could not be saved', code: 'IDEMPOTENCY_PENDING' });
        }
      })();
      return res;
    };
    next();
  };
}
