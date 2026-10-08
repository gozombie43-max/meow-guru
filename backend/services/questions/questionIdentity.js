import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';

export const canonicalQuestionUid = question => question.questionUid || `q_${createHash('sha256').update(`mongo:${String(question._id)}`).digest('hex').slice(0, 32)}`;

// Allocate before insertion; retries of the same import row have the same identity.
export function assignQuestionIdentity(question) {
  question._id ??= new ObjectId();
  question.questionUid = question.ingestionKey
    ? `q_${createHash('sha256').update(`import:${question.ingestionKey}`).digest('hex').slice(0, 32)}`
    : canonicalQuestionUid({ _id: question._id });
  return question;
}

export function legacyQuestionFilter(id, { topic, subject } = {}) {
  const values = [...new Set([String(id), ...(String(id).trim() && Number.isFinite(Number(id)) ? [Number(id)] : [])])];
  return { id: { $in: values }, ...(topic ? { topic: String(topic) } : {}), ...(subject ? { subject: String(subject) } : {}) };
}

export async function resolveQuestion(collection, reference, context = {}, options) {
  const uid = context.questionUid || (/^q_[a-f0-9]{32}$/.test(String(reference)) ? String(reference) : null);
  if (uid) return options ? collection.findOne({ questionUid: uid }, options) : collection.findOne({ questionUid: uid });
  const filter = legacyQuestionFilter(reference, context);
  const cursor = options ? collection.find(filter, options) : collection.find(filter);
  const rows = await cursor.limit(2).toArray();
  if (rows.length > 1) throw Object.assign(new Error('Question ID is ambiguous. Send questionUid or an unambiguous topic.'), { statusCode: 409, code: 'AMBIGUOUS_QUESTION_ID' });
  return rows[0] || null;
}
