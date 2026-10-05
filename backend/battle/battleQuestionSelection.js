import { randomBytes, randomInt } from 'node:crypto';
import { normalizeSearchKey } from '../services/questions/questionNormalizer.js';
import { mockAnswerIndex } from '../services/mockAnswer.js';

export async function selectBattleQuestions(collection, room, { pivot = randomBytes(32).toString('hex') } = {}) {
  const base = { battleEligible: true,
    ...(room.subject ? { subjectKey: normalizeSearchKey(room.subject) } : {}),
    ...(room.topic && room.topic !== 'all' ? { topicKey: normalizeSearchKey(room.topic) } : {}),
  };
  const candidates = [];
  let boundary = pivot, wrapped = false;
  for (let batch = 0; batch < 3; batch++) {
    const range = wrapped ? { $lt: pivot, ...(boundary ? { $gt: boundary } : {}) } : { $gte: boundary };
    const rows = await collection.find({ ...base, battleSelectionKey: range }, { projection: { _id: 1, questionUid: 1, battleSelectionKey: 1 }, maxTimeMS: 3000 })
      .sort({ battleSelectionKey: 1 }).limit(100).toArray();
    candidates.push(...rows);
    if (rows.length < 100) {
      if (wrapped) break;
      wrapped = true; boundary = null;
    } else {
      // Hex keys have a fixed length; suffix excludes the previous boundary.
      boundary = `${rows.at(-1).battleSelectionKey}0`;
    }
  }
  const unique = [...new Map(candidates.map(row => [String(row._id), row])).values()];
  for (let i = unique.length - 1; i > 0; i--) { const j = randomInt(i + 1); [unique[i], unique[j]] = [unique[j], unique[i]]; }
  const selected = unique.slice(0, Math.min(100, Math.max(1, room.questionCount || 10)));
  if (!selected.length) return [];
  const bodies = await collection.find({ ...base, _id: { $in: selected.map(row => row._id) } }, { maxTimeMS: 3000 }).limit(selected.length).toArray();
  const byId = new Map(bodies.map(row => [String(row._id), row]));
  return selected.map(row => byId.get(String(row._id))).filter(row => row && Array.isArray(row.options) && row.options.length >= 2 && mockAnswerIndex(row.correctAnswer, row.options) !== null);
}
