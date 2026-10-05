import { migrateUserHistory } from '../../repositories/userHistoryRepository.js';
import { createHash } from 'node:crypto';
import { canonicalQuestionUid } from './questionIdentity.js';
import { normalizedQuestionKeys } from './questionNormalizer.js';
import { trainingQuestionMetadata } from '../training/domain/questionMetadata.js';
import { battleQuestionMetadata } from './battleQuestionMetadata.js';
import { normalizeAccountEmail } from '../../repositories/authRegistrationRepository.js';

const referenceCollections = ['userQuestionProgress', 'trainingReviewState', 'trainingQuestionExposure', 'trainingSessions', 'mockAttempts', 'adaptiveQuizSessions', 'battleRooms', 'battleMatches', 'users', 'userQuizHistory'];
const guard = row => ({ _id: row._id, $expr: { $eq: ['$$ROOT', { $literal: row }] } });

// Never infer identity from an ID alone when more than one catalog document matches.
export function referenceResolver(catalog) {
  const byId = new Map(), byUid = new Map();
  for (const question of catalog) {
    const uid = canonicalQuestionUid(question);
    byUid.set(uid, { ...question, questionUid: uid });
    const key = String(question.id);
    byId.set(key, [...(byId.get(key) || []), { ...question, questionUid: uid }]);
  }
  return (id, context = {}) => {
    if (context.questionUid && byUid.has(context.questionUid)) return byUid.get(context.questionUid);
    if (byUid.has(String(id))) return byUid.get(String(id));
    let rows = byId.get(String(id)) || [];
    if (context.topic) rows = rows.filter(q => q.topic === context.topic);
    if (context.subject) rows = rows.filter(q => q.subject === context.subject);
    return rows.length === 1 ? rows[0] : null;
  };
}

export function migrateQuestionReferences(value, resolve, unresolved, path = '', context = {}) {
  if (!value || typeof value !== 'object' || value instanceof Date || value._bsontype) return value;
  if (Array.isArray(value)) return value.map((row, i) => migrateQuestionReferences(row, resolve, unresolved, `${path}[${i}]`, context));
  const next = { ...value };
  const scope = { ...context, ...(value.topic ? { topic: value.topic } : {}), ...(value.subject ? { subject: value.subject } : {}) };
  const snapshot = /(?:^|\.)questions\[\d+\]$/.test(path);
  const reference = value.questionId ?? (snapshot ? value.id : undefined);
  if (reference !== undefined) {
    const question = resolve(reference, { ...scope, questionUid: value.questionUid });
    if (!question) unresolved.push({ path, reference: String(reference), context: scope });
    else {
      next.questionUid = question.questionUid;
      if (snapshot) { next.legacyId ??= value.id; next.id = question.questionUid; }
      else { next.legacyQuestionId ??= value.questionId; next.questionId = question.questionUid; }
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object' && key !== '_id') next[key] = migrateQuestionReferences(child, resolve, unresolved, path ? `${path}.${key}` : key, scope);
  }
  if (Array.isArray(next.questions)) {
    const mappings = new Map(next.questions.filter(q => q.questionUid).map(q => [String(q.legacyId), q.questionUid]));
    if (value.answers && !Array.isArray(value.answers)) next.answers = Object.fromEntries(Object.entries(next.answers).map(([id, answer]) => [mappings.get(id) || id, answer]));
    if (Array.isArray(value.questionOrder)) next.questionOrder = value.questionOrder.map(id => mappings.get(String(id)) || id);
  }
  if (Array.isArray(value.bookmarks)) {
    next.bookmarks = value.bookmarks.map(id => {
      const entry = (value.bookmarkEntries || []).find(row => String(row.questionId) === String(id));
      const question = resolve(id, entry || {});
      if (!question) { unresolved.push({ path: `${path}.bookmarks`, reference: String(id) }); return id; }
      return question.questionUid;
    });
  }
  return next;
}

export async function backfillCanonicalIdentity(db, { apply = false } = {}) {
  const report = { apply, questions: 0, references: 0, changed: 0, conflicts: 0, unresolved: 0, accountCollisions: [], normalizationMismatches: 0 };
  const emails = new Map(), ids = new Set();
  for await (const user of db.collection('users').find({ type: { $ne: 'email_lock' } }, { projection: { id: 1, email: 1 } })) {
    const email = normalizeAccountEmail(user.email);
    if (ids.has(String(user.id)) || (email && emails.has(email))) report.accountCollisions.push(String(user._id));
    ids.add(String(user.id)); if (email) emails.set(email, user._id);
  }
  if (apply && report.accountCollisions.length) throw Object.assign(new Error('Account collisions must be reviewed before migration'), { report });
  const catalog = await db.collection('questions').find({}, { projection: { id: 1, questionUid: 1, topic: 1, subject: 1 } }).toArray();
  const resolve = referenceResolver(catalog);
  for await (const row of db.collection('questions').find({}).batchSize(250)) {
    report.questions++;
    const next = { ...row, questionUid: canonicalQuestionUid(row), ...normalizedQuestionKeys(row) };
    Object.assign(next, trainingQuestionMetadata(next), battleQuestionMetadata(next));
    if (JSON.stringify(next) === JSON.stringify(row)) continue;
    report.changed++;
    if (apply) {
      const result = await db.collection('questions').replaceOne(guard(row), next);
      report.conflicts += Number(!result.matchedCount);
    }
  }
  for (const name of referenceCollections) {
    for await (const row of db.collection(name).find({}).batchSize(100)) {
      const unresolved = [];
      const next = migrateQuestionReferences(row, resolve, unresolved);
      if (name === 'users' && row.type !== 'email_lock') {
        next.accountRecord = true;
        const email = normalizeAccountEmail(row.email);
        if (email) next.emailNormalized = email;
      }
      report.references++;
      report.unresolved += unresolved.length;
      if (apply && unresolved.length) {
        const reviewId = createHash('sha256').update(`${name}:${row._id}`).digest('hex');
        await db.collection('questionIdentityReview').updateOne({ _id: reviewId }, { $setOnInsert: { collection: name, sourceId: row._id, original: row, createdAt: new Date() }, $set: { unresolved, updatedAt: new Date() } }, { upsert: true });
      }
      // An unresolved session must remain internally consistent for operator repair.
      if (unresolved.length && name !== 'users') continue;
      if (JSON.stringify(next) !== JSON.stringify(row)) {
        report.changed++;
        if (apply) { const result = await db.collection(name).replaceOne(guard(row), next); report.conflicts += Number(!result.matchedCount); }
      }
    }
  }
  for await (const note of db.collection('notes').find({}).batchSize(100)) {
    const createdAt = new Date(note.createdAt || note._id?.getTimestamp?.() || 0);
    const updatedAt = new Date(note.updatedAt || createdAt);
    if (!Number.isFinite(+createdAt) || !Number.isFinite(+updatedAt)) { report.conflicts++; continue; }
    if (!(note.updatedAt instanceof Date) || !(note.createdAt instanceof Date)) {
      report.changed++;
      if (apply) await db.collection('notes').updateOne(guard(note), { $set: { createdAt, updatedAt } });
    }
  }
  for await (const user of db.collection('users').find({ type: { $ne: 'email_lock' }, historyStorageVersion: { $ne: 1 } }).batchSize(50)) {
    const history = await migrateUserHistory(db, user, { apply });
    report.conflicts += Number(!!history.conflicted);
  }
  if (apply && !report.conflicts) {
    const totals = await db.collection('userQuestionProgress').aggregate([
      { $match: { questionUid: { $type: 'string' } } },
      { $group: { _id: { userId: '$userId', topic: '$topic' }, solvedCount: { $sum: 1 }, masteredCount: { $sum: { $cond: ['$everCorrect', 1, 0] } } } },
    ]).toArray();
    // Run under the documented maintenance write fence; do not mix old aggregate counts.
    await db.collection('userTopicProgress').updateMany({}, { $set: { solvedCount: 0, masteredCount: 0 } });
    for (const row of totals) await db.collection('userTopicProgress').updateOne(row._id, { $set: { solvedCount: row.solvedCount, masteredCount: row.masteredCount } }, { upsert: true });
    await db.collection('questionMetadata').updateOne({ _id: 'revision' }, { $inc: { revision: 1 } }, { upsert: true });
  }
  return report;
}
