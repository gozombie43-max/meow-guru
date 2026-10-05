/* Read-only MongoDB audit evidence. Never imports startup or runs migrations. */
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const envFile = path.join(root, 'backend', '.env');
const env = { ...(fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {}), ...process.env };
const flagNames = ['QUESTIONS_NORMALIZED_KEYS', 'TRAINING_INDEXED_QUESTIONS', 'TRAINING_LOCAL_INGRESS', 'USE_COMPACT_TRAINING_HISTORY', 'USE_DURABLE_QUEUE', 'RUN_EMBEDDED_WORKERS', 'PROCESS_ROLE'];
const evidence = { observedAt: new Date().toISOString(), authority: 'Locally configured database; not proof of deployed environment', flags: Object.fromEntries(flagNames.map(k => [k, env[k] ?? null])), redisConfigured: Boolean(env.REDIS_URL), collections: {}, plans: [], errors: [] };
const outfile = path.join(root, 'MONGODB_ACCESS_AUDIT_LIVE_EVIDENCE.json');
const safeError = error => ({ name: error.name, code: error.code ?? null, codeName: error.codeName ?? null });
function summarize(plan) {
  const stages = new Set(), indexes = new Set();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.stage) stages.add(node.stage);
    if (node.indexName) indexes.add(node.indexName);
    for (const child of Object.values(node)) if (child && typeof child === 'object') visit(child);
  }
  visit(plan.queryPlanner?.winningPlan); visit(plan.executionStats?.executionStages);
  return { stages: [...stages], indexes: [...indexes], nReturned: plan.executionStats?.nReturned, totalKeysExamined: plan.executionStats?.totalKeysExamined, totalDocsExamined: plan.executionStats?.totalDocsExamined, executionTimeMillis: plan.executionStats?.executionTimeMillis };
}
async function main() {
  if (!env.MONGODB_URI) { evidence.errors.push({ operation: 'connect', reason: 'MONGODB_URI absent' }); return; }
  if (env.MONGODB_DNS_SERVERS) dns.setServers(env.MONGODB_DNS_SERVERS.split(',').map(s => s.trim()).filter(Boolean));
  const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 2, minPoolSize: 0, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db(env.MONGODB_DB || 'quizDB'); evidence.database = db.databaseName;
    try { const build = await db.command({ buildInfo: 1 }); evidence.serverVersion = build.version; } catch (e) { evidence.errors.push({ operation: 'buildInfo', ...safeError(e) }); }
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    for (const { name } of collections) {
      const row = evidence.collections[name] = {};
      try { row.indexes = await db.collection(name).listIndexes().toArray(); } catch (e) { row.indexError = safeError(e); }
      try { const stats = await db.command({ collStats: name, scale: 1 }); Object.assign(row, { count: stats.count, size: stats.size, avgObjSize: stats.avgObjSize, totalIndexSize: stats.totalIndexSize, indexSizes: stats.indexSizes }); } catch (e) { row.statsError = safeError(e); }
      try { row.indexUsage = await db.collection(name).aggregate([{ $indexStats: {} }], { maxTimeMS: 3000 }).toArray(); } catch (e) { row.usageError = safeError(e); }
    }
    const q = db.collection('questions');
    const sample = await q.findOne({ topic: { $type: 'string' } }, { projection: { topic: 1, topicKey: 1, subject: 1, subjectKey: 1, modeKey: 1, trainingExamSlugs: 1, trainingSubjectSlug: 1, trainingTopicSlug: 1 } });
    evidence.questionScopeSample = sample ? { topic: sample.topic, topicKey: sample.topicKey, subject: sample.subject, subjectKey: sample.subjectKey, modeKey: sample.modeKey, trainingExamSlugs: sample.trainingExamSlugs, trainingSubjectSlug: sample.trainingSubjectSlug, trainingTopicSlug: sample.trainingTopicSlug } : null;
    const user = await db.collection('users').findOne({ id: { $type: 'string' } }, { projection: { id: 1 } });
    const progress = await db.collection('userQuestionProgress').findOne({}, { projection: { userId: 1, questionId: 1 } });
    const probes = [
      ['notes-list', 'notes', {}, { updatedAt: -1, createdAt: -1, _ts: -1 }, 50],
      ['notes-id', 'notes', { id: '__audit_missing__' }, null, 1],
      ['access-code', 'accessCodes', { code: '__audit_missing__', active: true }, null, 1],
      ['question-progress', 'userQuestionProgress', { userId: progress?.userId || '__audit_missing__', questionId: progress?.questionId || '__audit_missing__' }, null, 1],
      ['topic-progress', 'userTopicProgress', { userId: progress?.userId || user?.id || '__audit_missing__' }, null, 50],
      ['training-skill-sort', 'trainingSkillState', { userId: user?.id || '__audit_missing__', exam: 'ssc-cgl' }, { mastery: 1 }, 5000],
      ['mock-exam-history', 'mockAttempts', { userId: user?.id || '__audit_missing__', examSlug: 'ssc-cgl' }, { startedAt: -1 }, 100],
      ['battle-lifetime-leaderboard', 'battleProfiles', { gamesPlayed: { $gte: 1 } }, { rating: -1, wins: -1, gamesPlayed: -1 }, 50],
      ['concept-grouping-claim', 'conceptGroupMetadata', { kind: 'concept-grouping', expiresAt: { $gt: new Date() }, attempts: { $lt: 3 }, $or: [{ status: 'queued', availableAt: { $lte: new Date() } }, { status: 'running', leaseUntil: { $lte: new Date() } }] }, { availableAt: 1 }, 1],
    ];
    const { buildModeFilter, caseInsensitiveExact } = await import('../backend/services/questions/questionQueryBuilder.js');
    if (sample?.topic) probes.push(['legacy-question-session', 'questions', { $and: [{ topic: sample.topic }, buildModeFilter('concept')] }, { _id: 1 }, 51]);
    if (sample?.subject) probes.push(['legacy-subject-session', 'questions', { $and: [{ subject: caseInsensitiveExact(sample.subject) }, buildModeFilter('concept')] }, { _id: 1 }, 51]);
    const normalizedSample = await q.findOne({ topicKey: { $type: 'string' }, modeKey: { $type: 'string' } }, { projection: { topicKey: 1, modeKey: 1 } });
    if (normalizedSample) probes.push(['normalized-question-session', 'questions', { topicKey: normalizedSample.topicKey, modeKey: normalizedSample.modeKey }, { _id: 1 }, 51]);
    const skillSample = await db.collection('trainingSkillState').findOne({}, { projection: { userId: 1, exam: 1 } });
    if (skillSample) probes.push(['training-skill-sort-populated', 'trainingSkillState', { userId: skillSample.userId, exam: skillSample.exam }, { mastery: 1 }, 5000]);
    const privateIds = new Set([user?.id, progress?.userId, progress?.questionId, skillSample?.userId].filter(Boolean));
    const publicShape = (_key, value) => privateIds.has(value) ? '<sample-private-id>' : value instanceof RegExp ? value.toString() : value;
    for (const [name, collection, filter, sort, limit] of probes) {
      try { let cursor = db.collection(collection).find(filter).maxTimeMS(3000).limit(limit); if (sort) cursor = cursor.sort(sort); evidence.plans.push({ name, collection, filterShape: JSON.stringify(filter, publicShape), sort, limit, ...summarize(await cursor.explain('executionStats')) }); }
      catch (e) { evidence.plans.push({ name, collection, error: safeError(e) }); }
    }
    for (const [collection, fields] of [['users', ['email']], ['users', ['id']], ['userQuestionProgress', ['userId', 'questionId']], ['userTopicProgress', ['userId', 'topic']]]) {
      try {
        const id = Object.fromEntries(fields.map(field => [field, `$${field}`]));
        const guard = collection === 'users' ? [{ $match: { [fields[0]]: { $type: 'string' }, type: { $ne: 'email_lock' } } }] : [];
        const rows = await db.collection(collection).aggregate([...guard, { $group: { _id: id, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $group: { _id: null, duplicateKeys: { $sum: 1 }, extraDocuments: { $sum: { $subtract: ['$n', 1] } } } }], { maxTimeMS: 3000 }).toArray();
        (evidence.duplicateChecks ||= []).push({ collection, fields, totals: rows[0] || { duplicateKeys: 0, extraDocuments: 0 } });
      } catch (e) { evidence.errors.push({ operation: 'duplicate-check', collection, ...safeError(e) }); }
    }
    const normalization = await q.aggregate([{ $group: { _id: null, total: { $sum: 1 }, missingTopicKey: { $sum: { $cond: [{ $eq: [{ $type: '$topicKey' }, 'missing'] }, 1, 0] } }, missingModeKey: { $sum: { $cond: [{ $eq: [{ $type: '$modeKey' }, 'missing'] }, 1, 0] } }, missingTrainingVersion: { $sum: { $cond: [{ $eq: [{ $type: '$trainingMetadataVersion' }, 'missing'] }, 1, 0] } } } }], { maxTimeMS: 3000 }).toArray();
    evidence.normalization = normalization[0];
    evidence.questionIdReuse = (await q.aggregate([{ $group: { _id: '$id', topics: { $addToSet: '$topic' }, n: { $sum: 1 } } }, { $match: { 'topics.1': { $exists: true } } }, { $group: { _id: null, reusedIds: { $sum: 1 }, documents: { $sum: '$n' } } }], { maxTimeMS: 3000 }).toArray())[0] || { reusedIds: 0, documents: 0 };
    evidence.documentSizes = [];
    for (const name of ['users', 'trainingSessions', 'mockSlots', 'mockAttempts', 'battleRooms']) {
      const rows = await db.collection(name).aggregate([{ $project: { bytes: { $bsonSize: '$$ROOT' } } }, { $group: { _id: null, count: { $sum: 1 }, maxBytes: { $max: '$bytes' }, averageBytes: { $avg: '$bytes' } } }], { maxTimeMS: 3000 }).toArray();
      evidence.documentSizes.push({ collection: name, ...(rows[0] || { count: 0 }) });
    }
  } catch (e) { evidence.errors.push({ operation: 'connect-or-inventory', ...safeError(e) }); }
  finally { await client.close(); }
}
main().finally(() => { fs.writeFileSync(outfile, JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify({ file: path.basename(outfile), collections: Object.keys(evidence.collections).length, plans: evidence.plans.length, errors: evidence.errors })); });
