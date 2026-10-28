import { battleQuestionMetadata } from './battleQuestionMetadata.js';
import { assertQuestionExamMode, parseQuestionExamMode, scopedQuestionFilter } from './questionExamMode.js';
import { assignQuestionIdentity, resolveQuestion } from './questionIdentity.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import crypto from "crypto";
import { invalidateQuestionMetadata } from "./questionMetadataCache.js";
import { refreshUploadedQuestionMetadata } from "./questionMetadataService.js";
import { getQuestionsCollection } from "../../config/mongodb.js";
import { questionCountsCache, questionsQueryCache } from "./questionCache.js";
import { normalizedQuestionKeys } from "./questionNormalizer.js";
import { trainingQuestionMetadata } from '../training/domain/questionMetadata.js';
import { normalizeLocalizedQuestion } from "./questionLocalization.js";

export async function createQuestion(newQuestion, { examMode } = {}) {
  assertQuestionExamMode(newQuestion, examMode);
  const collection = getQuestionsCollection();
  const normalizedInput = normalizeLocalizedQuestion(newQuestion);
  const item = assignQuestionIdentity({ ...normalizedInput, questionUid: undefined });

  if (!item.topic) {
    item.topic = item.chapter || item.subject || item.category || "misc";
  }
  item.topic = String(item.topic).trim() || "misc";

  Object.assign(item, normalizedQuestionKeys(item), trainingQuestionMetadata(item), battleQuestionMetadata(item));
  await collection.insertOne(item);
  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();

  await refreshUploadedQuestionMetadata([item]);

  const { _id, ...resource } = item;
  return resource;
}

export async function createQuestionsBulk(questionsData, { importId, examMode } = {}) {
  // Validate the entire batch before writing any rows to prevent mixed-bank imports.
  parseQuestionExamMode(examMode);
  if (examMode) questionsData.forEach(question => assertQuestionExamMode(question, examMode));
  const collection = getQuestionsCollection();
  const invalid = new Set();

  const normalizedQuestions = questionsData.map((q, idx) => {
    if (!q || typeof q !== 'object' || Array.isArray(q)) { invalid.add(idx); return null; }
    const item = normalizeLocalizedQuestion(
      q && typeof q === "object" ? { ...q } : { value: q }
    );

    if (item.id !== undefined && item.id !== null) {
      item.id = String(item.id).trim();
    }

    if (!item.id) {
      const suffix = crypto.randomUUID
        ? crypto.randomUUID()
        : crypto.randomBytes(8).toString("hex");
      item.id = `q_${Date.now()}_${idx}_${suffix}`;
    }

    const quizSubject = String(item.quizSubject ?? "").trim();
    const quizTopic = String(item.quizTopic ?? "").trim();

    if (item.word && item.meanings && item.synonyms && item.antonyms) {
      item.questionType = item.questionType || "study-mode";
      item.quizName = String(item.quizName || "Study Mode").trim();
    }

    if (!item.subject && quizSubject) item.subject = quizSubject;
    if (!item.chapter && quizTopic) item.chapter = quizTopic;
    if (quizTopic) item.topic = quizTopic;
    if (!item.topic)
      item.topic = item.chapter || item.subject || item.category || "misc";
    item.topic = String(item.topic).trim() || "misc";

    delete item._id;
    delete item.ingestionKey;
    delete item.ingestionHash;
    if (importId) {
      const digest = value => crypto.createHash('sha256').update(value).digest('hex');
      item.ingestionKey = digest(`${importId}:${idx}`);
      item.ingestionHash = digest(JSON.stringify(q));
      if (!q.id) item.id = `q_${item.ingestionKey}`;
    }
    return Object.assign(assignQuestionIdentity(item), normalizedQuestionKeys(item), trainingQuestionMetadata(item), battleQuestionMetadata(item));
  });

  const results = new Array(normalizedQuestions.length);
  for (const index of invalid) results[index] = { status: 'rejected', reason: { code: 'INVALID_ROW', message: 'Question must be an object' } };
  try {
    for (let offset = 0; offset < normalizedQuestions.length; offset += 500) {
      let pending = normalizedQuestions.slice(offset, offset + 500).map((value, index) => ({ value, index: offset + index })).filter(entry => entry.value);
      for (let attempt = 0; pending.length && attempt < 4; attempt++) {
        const operations = pending.map(({ value }) => importId
          ? { updateOne: { filter: { ingestionKey: value.ingestionKey, ingestionHash: value.ingestionHash }, update: { $setOnInsert: value }, upsert: true } }
          : { insertOne: { document: value } });
        let errors = new Map();
        let ambiguous;
        try { await collection.bulkWrite(operations, { ordered: false }); }
        catch (error) {
          errors = new Map((error.writeErrors || []).map(entry => [entry.index, entry]));
          if (!error.result || !errors.size || error.writeConcernErrors?.length || error.result.getWriteConcernError?.()) ambiguous = error;
        }
        const retry = [];
        pending.forEach((entry, index) => {
          const failure = errors.get(index) || ambiguous;
          if (failure?.code === 11000 && !importId && attempt < 3) {
            const value = { ...entry.value, id: `q_${crypto.randomUUID()}` };
            delete value._id;
            Object.assign(value, trainingQuestionMetadata(value), battleQuestionMetadata(value));
            retry.push({ ...entry, value });
          } else if (failure) {
            results[entry.index] = { status: 'rejected', reason: { code: failure.code, message: ambiguous ? 'Write outcome unknown; retry with the same import ID' : failure.errmsg || failure.message || 'Bulk row failed' } };
          } else {
            const { _id, ...value } = entry.value;
            results[entry.index] = { status: 'fulfilled', value };
          }
        });
        pending = retry;
      }
    }
    return results;
  } finally {
    questionsQueryCache.clear();
    questionCountsCache.clear();
    await invalidateQuestionMetadata();
    await refreshUploadedQuestionMetadata(normalizedQuestions.filter(Boolean));
  }
}

export async function modifyQuestion(id, updates, topic = undefined, examMode = undefined) {
  const collection = getQuestionsCollection();
  const existing = await resolveQuestion(collection, id, { topic, examMode });
  if (!existing) return null;

  const normalizedUpdates = normalizeLocalizedQuestion(updates);
  const updated = { ...existing, ...normalizedUpdates, id: existing.id, questionUid: existing.questionUid };
  assertQuestionExamMode(updated, examMode);
  delete updated._id;

  if (!updated.topic) {
    updated.topic =
      existing.topic || updates.chapter || updates.subject || "misc";
  }

  Object.assign(updated, normalizedQuestionKeys(updated), trainingQuestionMetadata(updated), battleQuestionMetadata(updated));
  await collection.updateOne(scopedQuestionFilter({ _id: existing._id }, examMode), { $set: updated });
  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();
  await refreshUploadedQuestionMetadata([existing, updated]);
  return updated;
}

export async function removeQuestion(id, topic = undefined, examMode = undefined) {
  const collection = getQuestionsCollection();
  const existing = await resolveQuestion(collection, id, { topic, examMode });
  if (!existing) return false;
  const result = await collection.deleteOne(scopedQuestionFilter({ _id: existing._id }, examMode));

  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();
  return result.deletedCount > 0;
}

export async function removeQuestionsBulk(ids, examMode = undefined, context = {}) {
  parseQuestionExamMode(examMode);
  const collection = getQuestionsCollection();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { deleted: 0, failed: 0, total: 0 };
  }

  const uniqueIds = Array.from(
    new Set(ids.map((id) => String(id).trim()).filter(Boolean)),
  );

  if (uniqueIds.length === 0) {
    return { deleted: 0, failed: 0, total: 0 };
  }

  try {
    const resolved = [];
    for (const id of uniqueIds) {
      const question = await resolveQuestion(collection, id, { examMode, ...context });
      if (question) resolved.push(question._id);
    }
    const result = await collection.deleteMany(scopedQuestionFilter({ _id: { $in: resolved } }, examMode));
    questionsQueryCache.clear();
    questionCountsCache.clear();
    await invalidateQuestionMetadata();

    return {
      deleted: result.deletedCount,
      failed: 0,
      total: uniqueIds.length,
    };
  } catch (err) {
    if (err.statusCode === 409) throw err;
    runtimeLog.error("removeQuestionsBulk error:", err);

    return {
      deleted: 0,
      failed: uniqueIds.length,
      total: uniqueIds.length,
    };
  }
}

export async function checkDuplicates(questions, examMode = undefined) {
  parseQuestionExamMode(examMode);
  const collection = getQuestionsCollection();

  const questionIdentifier = q => String(q.id || q._id || q.questionId || "").trim();
  const ids = questions
    .map(questionIdentifier)
    .filter(Boolean);

  const normalizeContentText = value => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const contentText = value => {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (typeof value === "object" && !Array.isArray(value)) return contentText(value.en ?? value.text ?? value.bn ?? value.hi ?? value.value);
    return "";
  };
  const contentOptions = (q) => {
    const normalized = normalizeLocalizedQuestion(q || {});
    const raw = normalized.options ?? normalized.choices ?? normalized.answers;
    if (Array.isArray(raw)) return raw.map(contentText);
    if (raw && typeof raw === "object") {
      if (Array.isArray(raw.en)) return raw.en.map(contentText);
      if (Array.isArray(raw.bn)) return raw.bn.map(contentText);
      return Object.values(raw).map(contentText);
    }
    return [];
  };
  const contentScope = q => {
    const normalized = normalizeLocalizedQuestion(q || {});
    return [normalized.subject ?? normalized.quizSubject, normalized.topic ?? normalized.chapter ?? normalized.quizTopic]
      .map(normalizeContentText)
      .join("\u0000");
  };
  const getQuestionText = (q) => {
    const normalized = normalizeLocalizedQuestion(q || {});
    return contentText(normalized.question ?? normalized.questionText ?? normalized.q);
  };
  const contentFingerprint = q => {
    const text = normalizeContentText(getQuestionText(q));
    const options = contentOptions(q).map(normalizeContentText);
    return text && options.length && options.every(Boolean) ? `${contentScope(q)}\u0000${text}\u0000${options.join("\u0000")}` : "";
  };
  // A supplied source ID is the record identity. Content matching remains a
  // safe fallback for legacy rows that do not carry one.
  const incomingTexts = questions.filter(q => !questionIdentifier(q)).map(getQuestionText).filter(Boolean);
  const uniqueIds = Array.from(new Set(ids));
  const uniqueTexts = Array.from(new Set(incomingTexts));

  if (uniqueIds.length === 0 && uniqueTexts.length === 0) {
    return [];
  }

  const existingMap = new Map();

  if (uniqueIds.length > 0) {
    const existingById = await collection
      .find(scopedQuestionFilter({ id: { $in: uniqueIds } }, examMode))
      .project({
        _id: 0,
        id: 1,
        question: 1,
        questionText: 1,
        options: 1,
        subject: 1,
        quizSubject: 1,
        topic: 1,
        chapter: 1,
        quizTopic: 1,
      })
      .toArray();

    for (const r of existingById) {
      existingMap.set(String(r.id), r.question || r.questionText || "");
    }
  }

  const textBatchSize = 50;
  const existingContentMap = new Map();

  for (let i = 0; i < uniqueTexts.length; i += textBatchSize) {
    const batch = uniqueTexts.slice(i, i + textBatchSize);
    const existingByText = await collection
      .find(scopedQuestionFilter({
        $or: [{ question: { $in: batch } }, { questionText: { $in: batch } }],
      }, examMode))
      .project({
        _id: 0,
        id: 1,
        question: 1,
        questionText: 1,
        options: 1,
        subject: 1,
        quizSubject: 1,
        topic: 1,
        chapter: 1,
        quizTopic: 1,
      })
      .toArray();

    for (const r of existingByText) {
      const fingerprint = contentFingerprint(r);
      if (fingerprint) existingContentMap.set(fingerprint, r.id);
    }
  }

  const duplicates = [];
  questions.forEach((q, index) => {
    const qId = questionIdentifier(q);
    const qText = getQuestionText(q);
    const fingerprint = contentFingerprint(q);

    if (qId && existingMap.has(qId)) {
      duplicates.push({ index, id: qId, reason: "Duplicate ID" });
    } else if (!qId && qText && fingerprint && existingContentMap.has(fingerprint)) {
      duplicates.push({
        index,
        id: qId,
        matchedId: existingContentMap.get(fingerprint),
        reason: "Duplicate Question Content",
      });
    }
  });

  return duplicates;
}
