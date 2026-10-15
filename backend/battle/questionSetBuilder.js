import { createHmac, createHash } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';
import { normalizeSearchKey } from '../services/questions/questionNormalizer.js';
import { selectBattleQuestions } from './battleQuestionSelection.js';
import { battleQuestionMetadata } from '../services/questions/battleQuestionMetadata.js';

export const BATTLE_SELECTION_VERSION = 'ranked-v2';
const poolError = message => Object.assign(new Error(message), { code: 'BATTLE_QUESTION_POOL' });
const identity = question => String(question.questionUid || question._id || question.id);
const rank = (seed, value) => createHmac('sha256', seed).update(String(value)).digest('hex');
export function rankedBlueprint(count) { const easy = Math.round(count * .3), medium = Math.round(count * .4); return { easy, medium, hard: count - easy - medium }; }

async function candidatesFor(collection, base, pivot) {
  const rows = [], seen = new Set();
  for (const direction of [{ $gte: pivot }, { $lt: pivot }]) {
    let boundary;
    for (let page = 0; page < 3 && rows.length < 300; page++) {
      const filter = { ...base, battleSelectionKey: { ...direction, ...(boundary ? { $gt: boundary } : {}) } };
      const batch = await collection.find(filter, { projection: { _id: 1, questionUid: 1, battleSelectionKey: 1, battleConceptKey: 1, battleExamKey: 1, battleYear: 1 }, maxTimeMS: 3000 }).sort({ battleSelectionKey: 1 }).limit(Math.min(100, 300 - rows.length)).toArray();
      for (const row of batch) if (!seen.has(identity(row))) { rows.push(row); seen.add(identity(row)); }
      if (batch.length < 100) break;
      boundary = batch.at(-1).battleSelectionKey;
    }
  }
  return rows;
}

export async function buildBattleQuestionSet(collection, room, { histories, secret = process.env.BATTLE_SELECTION_SECRET || process.env.JWT_SECRET } = {}) {
  if (room.mode !== 'ranked') {
    const questions = await selectBattleQuestions(collection, room);
    return { questions, selectionVersion: 'casual-v1', selectedQuestionIds: questions.map(identity) };
  }
  if (!secret || secret.length < 32) throw new Error('Ranked question selection requires a server secret of at least 32 characters.');
  const count = Number(room.questionCount), blueprint = rankedBlueprint(count);
  const seed = room.selectionSeed || rank(secret, `${room.code}:${new Date(room.createdAt).toISOString()}:${room.seasonKey || ''}:${BATTLE_SELECTION_VERSION}`);
  const base = { rankedEligible: true, subjectKey: normalizeSearchKey(room.subject), battleLanguage: room.language || 'en',
    battleMedia: room.supportsImages ? { $in: ['text', 'image'] } : 'text', ...(room.topic && room.topic !== 'all' ? { topicKey: normalizeSearchKey(room.topic) } : {}) };
  const recent = histories || await Promise.all(room.players.map(player => getMongoDB().collection('battleQuestionHistory').find({ userId: player.userId }, { projection: { questionUid: 1 }, maxTimeMS: 3000 }).sort({ playedAt: -1, _id: -1 }).limit(100).toArray()));
  const buckets = {};
  for (const difficulty of Object.keys(blueprint)) buckets[difficulty] = (await candidatesFor(collection, { ...base, battleDifficulty: difficulty }, rank(seed, `pivot:${difficulty}`))).map(row => ({ ...row, selectionDifficulty: difficulty }))
    .sort((a, b) => rank(seed, identity(a)).localeCompare(rank(seed, identity(b))));
  const conceptLimit = Math.max(2, Math.ceil(count * .4));
  for (const historyWindow of [100, 50, 20, 0]) {
    const excluded = new Set(recent.flatMap(history => history.slice(0, historyWindow).map(row => String(row.questionUid))));
    const selected = [], concepts = new Map(), exams = new Map(), ids = new Set();
    const exam = row => `${row.battleExamKey || 'unspecified'}:${row.battleYear || 'unspecified'}`;
    for (const [difficulty, target] of Object.entries(blueprint)) {
      let taken = 0;
      while (taken < target) {
        // Prefer the least represented exam/year group, retaining seeded
        // order for ties. This is a soft diversity rule for single-exam pools.
        const available = buckets[difficulty].filter(row => !excluded.has(identity(row)) && !ids.has(identity(row))
          && row.battleConceptKey && (concepts.get(row.battleConceptKey) || 0) < conceptLimit);
        available.sort((a, b) => (exams.get(exam(a)) || 0) - (exams.get(exam(b)) || 0));
        const row = available[0];
        if (!row) break;
        const id = identity(row), concept = row.battleConceptKey;
        selected.push(row); ids.add(id); concepts.set(concept, (concepts.get(concept) || 0) + 1);
        exams.set(exam(row), (exams.get(exam(row)) || 0) + 1); taken++;
      }
      if (taken !== target) break;
    }
    if (selected.length !== count) continue;
    const bodies = await collection.find({ ...base, _id: { $in: selected.map(row => row._id) } }, { maxTimeMS: 3000 }).limit(count).toArray();
    const expected = new Map(selected.map(row => [identity(row), row]));
    const byId = new Map(bodies.filter(row => {
      const metadata = battleQuestionMetadata(row), candidate = expected.get(identity(row));
      return candidate && metadata.rankedEligible && metadata.battleDifficulty === candidate.selectionDifficulty && metadata.battleConceptKey === candidate.battleConceptKey;
    }).map(row => [identity(row), row]));
    const questions = selected.map(row => byId.get(identity(row))).filter(Boolean);
    if (questions.length !== count) throw poolError('The certified question pool changed. Please try again.');
    questions.sort((a, b) => rank(seed, `order:${identity(a)}`).localeCompare(rank(seed, `order:${identity(b)}`)));
    return { questions, selectionVersion: BATTLE_SELECTION_VERSION, selectionSeed: seed,
      selectionSeedHash: createHash('sha256').update(seed).digest('hex'), selectedQuestionIds: questions.map(identity),
      selectionBlueprint: blueprint, selectionHistoryWindow: historyWindow, selectionConceptLimit: conceptLimit };
  }
  throw poolError('Not enough certified questions for a balanced ranked match in this topic. Try another topic or a private battle.');
}
