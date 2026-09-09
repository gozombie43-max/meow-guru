import { getMongoDB } from '../config/mongodb.js';
import { createHash } from 'node:crypto';

export class MongoRateLimitStore {
  localKeys = false;
  constructor(prefix) { this.prefix = prefix; }
  init(options) { this.windowMs = options.windowMs; }
  key(key) { return `${this.prefix}:${createHash('sha256').update(String(key)).digest('hex')}`; }
  async increment(key) {
    const collection = getMongoDB().collection('rateLimits');
    const expired = { $lte: [{ $ifNull: ['$resetTime', new Date(0)] }, '$$NOW'] };
    let row;
    const write = () => collection.findOneAndUpdate({ _id: this.key(key) }, [{ $set: {
      totalHits: { $cond: [expired, 1, { $add: ['$totalHits', 1] }] },
      resetTime: { $cond: [expired, { $add: ['$$NOW', this.windowMs] }, '$resetTime'] },
    } }], { upsert: true, returnDocument: 'after' });
    try { row = await write(); } catch (error) { if (error.code !== 11000) throw error; row = await write(); }
    return { totalHits: row.totalHits, resetTime: row.resetTime };
  }
  async decrement(key) {
    await getMongoDB().collection('rateLimits').updateOne({ _id: this.key(key), totalHits: { $gt: 0 } }, { $inc: { totalHits: -1 } });
  }
  async resetKey(key) { await getMongoDB().collection('rateLimits').deleteOne({ _id: this.key(key) }); }
}
