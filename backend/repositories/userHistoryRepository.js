import { getMongoDB, withMongoTransaction } from '../config/mongodb.js';
import { mergeQuizEntry } from '../services/userHistory.js';

const names = { recentQuizzes: 'userQuizHistory', aiChats: 'aiConversations', bookmarkEntries: 'userBookmarks' };
const keyFor = (field, row) => field === 'aiChats' ? row.id : (field === 'bookmarkEntries' ? row.questionId : row.quizKey);
const limits = { recentQuizzes: 12, aiChats: 30, bookmarkEntries: 60 };
export const analyticsFields = ['failureMap', 'masteryMap', 'timePerQuestion'];

// The caller commits the owner revision and concept counters in this transaction.
export async function persistQuizResume(db, session, owner, body) {
  if (owner.historyStorageVersion !== 1) {
    const rows = owner.recentQuizzes || [];
    const entry = mergeQuizEntry(rows.find(row => row.quizKey === body.quizKey), body);
    return [entry, ...rows.filter(row => row.quizKey !== body.quizKey)].slice(0, 12);
  }
  const history = db.collection('userQuizHistory'), userId = String(owner.id);
  const filter = { userId, quizKey: body.quizKey };
  const previous = await history.findOne(filter, { session });
  const { _id, userId: _owner, ...entry } = mergeQuizEntry(previous, body);
  await history.replaceOne(filter, { ...entry, userId }, { session, upsert: true });
  const excluded = await history.find({ userId }, { session, projection: { quizKey: 1 } })
    .sort({ updatedAt: -1, _id: -1 }).skip(12).toArray();
  if (excluded.length) await history.deleteMany({ userId, quizKey: { $in: excluded.map(row => row.quizKey) } }, { session });
  return undefined;
}

export async function readSeparatedHistory(db, userId, field, session, { summaries = false } = {}) {
  const rows = await db.collection(names[field]).find({ userId: String(userId) }, { session }).sort({ updatedAt: -1, _id: -1 }).limit(limits[field]).toArray();
  if (field === 'aiChats' && !summaries && rows.length) {
    const messages = await db.collection('aiMessages').find({ userId: String(userId), conversationId: { $in: rows.map(row => row.id) } }, { session }).sort({ position: 1 }).limit(30 * 80).toArray();
    for (const row of rows) row.messages = messages.filter(message => message.conversationId === row.id).map(message => message.message);
  }
  return rows.map(({ _id, userId: _owner, ...row }) => row);
}

async function storeEntry(db, userId, field, entry, session) {
  const key = keyFor(field, entry);
  if (typeof key !== 'string' || !key) throw Object.assign(new Error('History identity is required'), { statusCode: 400 });
  const filter = { userId: String(userId), [field === 'aiChats' ? 'id' : 'quizKey']: key };
  const { messages, ...metadata } = entry;
  await db.collection(names[field]).replaceOne(filter, { ...metadata, userId: String(userId), ...(field === 'aiChats' ? { messageCount: (messages || []).length, messagePositionVersion: 0 } : {}) }, { session, upsert: true });
  if (field === 'aiChats') {
    const messagesCollection = db.collection('aiMessages');
    await messagesCollection.deleteMany({ userId: String(userId), conversationId: key }, { session });
    if (messages?.length) await messagesCollection.insertMany(messages.slice(-80).map((message, position) => ({ userId: String(userId), conversationId: key, position, message })), { session });
  }
}

export async function mutateSeparatedHistory(userId, field, mutate) {
  return withMongoTransaction(async ({ db, session }) => {
    const user = await db.collection('users').findOne({ id: String(userId), historyStorageVersion: 1 }, { session, projection: { id: 1, [`${field}Revision`]: 1 } });
    if (!user) throw Object.assign(new Error('History storage changed; retry'), { statusCode: 409 });
    const before = await readSeparatedHistory(db, userId, field, session);
    const next = mutate(before).slice(0, limits[field]);
    const beforeById = new Map(before.map(row => [keyFor(field, row), row]));
    for (const entry of next) if (JSON.stringify(entry) !== JSON.stringify(beforeById.get(keyFor(field, entry)))) await storeEntry(db, userId, field, entry, session);
    const retained = next.map(row => keyFor(field, row));
    await db.collection(names[field]).deleteMany({ userId: String(userId), [field === 'aiChats' ? 'id' : 'quizKey']: { $nin: retained } }, { session });
    if (field === 'aiChats') await db.collection('aiMessages').deleteMany({ userId: String(userId), conversationId: { $nin: retained } }, { session });
    // The small revision update fences concurrent saves and account deletion.
    await db.collection('users').updateOne({ _id: user._id, historyStorageVersion: 1 }, { $inc: { [`${field}Revision`]: 1 } }, { session });
    return next;
  });
}

export async function migrateUserHistory(db, user, { apply = false } = {}) {
  if (user.historyStorageVersion === 1) return { migrated: false };
  if (!apply) return { migrated: false, candidates: (user.recentQuizzes?.length || 0) + (user.aiChats?.length || 0) };
  for (const field of Object.keys(names)) {
    const expected = (user[field] || []).slice(0, limits[field]);
    for (const entry of expected) await storeEntry(db, user.id, field, entry);
    const actual = await readSeparatedHistory(db, user.id, field);
    const byId = new Map(actual.map(row => [keyFor(field, row), row]));
    for (const entry of expected) {
      const saved = byId.get(keyFor(field, entry));
      if (!saved || Object.keys(entry).some(key => JSON.stringify(entry[key]) !== JSON.stringify(saved[key]))) throw new Error(`History parity failed for ${field}`);
    }
  }
  await db.collection('userAnalytics').updateOne({ userId: String(user.id) }, { $set: Object.fromEntries(analyticsFields.filter(field => user[field] !== undefined).map(field => [field, user[field]])) }, { upsert: true });
  const result = await db.collection('users').updateOne({ _id: user._id, $expr: { $eq: ['$$ROOT', { $literal: user }] } }, { $set: { historyStorageVersion: 1 } });
  return { migrated: result.matchedCount === 1, conflicted: result.matchedCount !== 1 };
}

export async function deleteSeparatedHistory(userId, db = getMongoDB(), session) {
  for (const name of [...Object.values(names), 'aiMessages', 'userAnalytics']) await db.collection(name).deleteMany({ userId: String(userId) }, { session });
}
