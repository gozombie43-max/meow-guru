import { getMongoDB, withMongoTransaction } from '../config/mongodb.js';

const COLLECTION = 'mockCatalogMetadata';
const READY = '__initialized__';
const missing = () => Object.assign(new Error('Paper count metadata needs initialization. Run database migrations.'), { statusCode: 503 });
const empty = examSlug => ({ examSlug, mockCount: 0, pyqCount: 0, total: 0, tiers: [], years: [], groups: [] });

// Recount only on catalog writes or explicit backfill, never on a public read.
export async function rebuildMockCatalogMetadata(db, examSlug, options = {}) {
  const groups = await db.collection('mockSlots').aggregate([
    { $match: { examSlug } },
    { $group: { _id: {
      kind: { $cond: [{ $or: [{ $eq: ['$isPyq', true] }, { $eq: [{ $toLower: { $ifNull: ['$type', ''] } }, 'pyq'] }] }, 'pyq', 'mock'] },
      tier: { $ifNull: ['$tier', ''] }, year: { $convert: { input: '$year', to: 'int', onError: null, onNull: null } },
    }, count: { $sum: 1 } } },
    { $project: { _id: 0, kind: '$_id.kind', tier: '$_id.tier', year: '$_id.year', count: 1 } },
  ], options).toArray();
  const snapshot = empty(examSlug);
  snapshot.groups = groups;
  for (const group of groups) {
    snapshot[group.kind === 'pyq' ? 'pyqCount' : 'mockCount'] += group.count;
    if (group.tier && !snapshot.tiers.includes(group.tier)) snapshot.tiers.push(group.tier);
    if (group.kind === 'pyq' && group.year >= 1000 && group.year <= 2999 && !snapshot.years.includes(group.year)) snapshot.years.push(group.year);
  }
  snapshot.total = snapshot.mockCount + snapshot.pyqCount;
  snapshot.tiers.sort(); snapshot.years.sort((a, b) => b - a);
  snapshot.updatedAt = new Date().toISOString();
  await db.collection(COLLECTION).updateOne({ _id: examSlug }, { $set: snapshot }, { ...options, upsert: true });
  return snapshot;
}

export async function initializeMockCatalogMetadata(db) {
  // Snapshot question availability once for historical records; normal writes
  // already know these values and store them with the paper.
  await db.collection('mockSlots').updateMany({}, [{ $set: {
    questionCount: { $cond: [{ $gt: [{ $size: { $cond: [{ $isArray: '$fixedQuestions' }, '$fixedQuestions', []] } }, 0] }, { $size: '$fixedQuestions' }, { $ifNull: ['$questionCount', 0] }] },
    hasFixedPaper: { $or: [{ $ne: [{ $ifNull: ['$sourcePaper', null] }, null] }, { $gt: [{ $size: { $cond: [{ $isArray: '$fixedQuestions' }, '$fixedQuestions', []] } }, 0] }] },
  } }]);
  const exams = new Set([...(await db.collection('mockSlots').distinct('examSlug')), ...(await db.collection(COLLECTION).distinct('examSlug'))]);
  for (const exam of exams) if (typeof exam === 'string') await rebuildMockCatalogMetadata(db, exam);
  await db.collection(COLLECTION).updateOne({ _id: READY }, { $set: { updatedAt: new Date().toISOString() } }, { upsert: true });
}

export async function mutateMockCatalog(examSlug, mutation) {
  return withMongoTransaction(async ({ db, session }) => {
    // Serialize same-exam writers before reading the new counts. The slot change
    // and its snapshot commit together; failures roll both back.
    await db.collection(COLLECTION).updateOne({ _id: examSlug }, { $inc: { revision: 1 } }, { session, upsert: true });
    const result = await mutation(db.collection('mockSlots'), { session });
    await rebuildMockCatalogMetadata(db, examSlug, { session });
    return result;
  });
}

export async function readMockCatalogSummary() {
  const collection = getMongoDB().collection(COLLECTION);
  if (!await collection.findOne({ _id: READY }, { projection: { _id: 1 } })) throw missing();
  return collection.find({ examSlug: { $type: 'string' } }, { projection: { _id: 0, examSlug: 1, mockCount: 1, pyqCount: 1, total: 1, updatedAt: 1 } }).toArray();
}

export async function readMockCatalogMetadata(examSlug, { kind = 'mock', tier = '', year = '' } = {}) {
  const collection = getMongoDB().collection(COLLECTION);
  const saved = await collection.findOne({ _id: examSlug });
  if (!saved && !await collection.findOne({ _id: READY }, { projection: { _id: 1 } })) throw missing();
  const snapshot = saved || empty(examSlug);
  const total = snapshot.groups.filter(group => group.kind === kind && (!tier || !group.tier || group.tier === tier) && (!year || group.year === Number(year))).reduce((sum, group) => sum + group.count, 0);
  return { metadata: { mockCount: snapshot.mockCount, pyqCount: snapshot.pyqCount, tiers: snapshot.tiers, years: snapshot.years }, total };
}
