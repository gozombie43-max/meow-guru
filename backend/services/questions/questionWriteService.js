import { battleQuestionMetadata } from './battleQuestionMetadata.js';
import { assertQuestionExamMode, parseQuestionExamMode, scopedQuestionFilter } from './questionExamMode.js';
import { assignQuestionIdentity, canonicalQuestionUid, resolveQuestion } from './questionIdentity.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import crypto from "crypto";
import { invalidateQuestionMetadata } from "./questionMetadataCache.js";
import { refreshUploadedQuestionMetadata } from "./questionMetadataService.js";
import { getQuestionsCollection } from "../../config/mongodb.js";
import { questionCountsCache, questionsQueryCache } from "./questionCache.js";
import { buildNormalizedQuestionFields, deriveModeKey, normalizeSearchKey } from "./questionNormalizer.js";
import { trainingQuestionMetadata } from '../training/domain/questionMetadata.js';
import { normalizeLocalizedQuestion } from "./questionLocalization.js";

function dedupeScopeQuestions(questions) {
  const seen = new Set();
  const deduped = [];
  for (const question of questions) {
    if (!question || typeof question !== "object") continue;
    const key = `${normalizeSearchKey(question.subject)}::${normalizeSearchKey(question.topic)}::${deriveModeKey(question)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(question);
  }
  return deduped;
}

export async function createQuestion(newQuestion, { examMode } = {}) {
  assertQuestionExamMode(newQuestion, examMode);
  const collection = getQuestionsCollection();
  const normalizedInput = normalizeLocalizedQuestion(newQuestion);
  const item = assignQuestionIdentity({ ...normalizedInput, questionUid: undefined });

  if (!item.topic) {
    item.topic = item.chapter || item.subject || item.category || "misc";
  }
  item.topic = String(item.topic).trim() || "misc";

  Object.assign(item, buildNormalizedQuestionFields(item), trainingQuestionMetadata(item), battleQuestionMetadata(item));
  await collection.insertOne(item);
  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();
  await refreshUploadedQuestionMetadata(dedupeScopeQuestions([item]));

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
    const identified = assignQuestionIdentity(item);
    return Object.assign(identified, buildNormalizedQuestionFields(identified), trainingQuestionMetadata(identified), battleQuestionMetadata(identified));
  });

  const results = new Array(normalizedQuestions.length);
  for (const index of invalid) results[index] = { status: 'rejected', reason: { code: 'INVALID_ROW', message: 'Question must be an object' } };
  let hadMutation = false;
  const succeeded = [];
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
            Object.assign(value, buildNormalizedQuestionFields(value), trainingQuestionMetadata(value), battleQuestionMetadata(value));
            retry.push({ ...entry, value });
          } else if (failure) {
            if (ambiguous) hadMutation = true;
            results[entry.index] = { status: 'rejected', reason: { code: failure.code, message: ambiguous ? 'Write outcome unknown; retry with the same import ID' : failure.errmsg || failure.message || 'Bulk row failed' } };
          } else {
            hadMutation = true;
            const { _id, ...value } = entry.value;
            succeeded.push(value);
            results[entry.index] = { status: 'fulfilled', value };
          }
        });
        pending = retry;
      }
    }
    return results;
  } finally {
    if (hadMutation) {
      questionsQueryCache.clear();
      questionCountsCache.clear();
      await invalidateQuestionMetadata();
      const refreshTargets = dedupeScopeQuestions(succeeded.length ? succeeded : normalizedQuestions);
      if (refreshTargets.length) {
        await refreshUploadedQuestionMetadata(refreshTargets);
      }
    }
  }
}

const IMMUTABLE_QUESTION_FIELDS = new Set([
  '_id', 'id', 'questionUid', 'ingestionKey', 'ingestionHash', 'createdAt',
  'battleSelectionKey', 'rankedEligible', 'battleEligible',
  'trainingMetadataVersion', 'trainingCandidate', 'trainingEligible',
  'topicKey', 'subjectKey', 'quizKey', 'modeKey', 'keyVersion',
  'examKey', 'conceptKey', 'chapterKey', 'topicGroupKey', 'examModeKey',
  'yearInt', 'shiftInt', 'selectionKey',
]);

function mergeTranslations(existingTranslations, incomingTranslations) {
  if (!incomingTranslations || typeof incomingTranslations !== 'object' || Array.isArray(incomingTranslations)) {
    return existingTranslations;
  }
  const base = existingTranslations && typeof existingTranslations === 'object' && !Array.isArray(existingTranslations)
    ? { ...existingTranslations }
    : {};
  for (const [lang, value] of Object.entries(incomingTranslations)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[lang] && typeof base[lang] === 'object' && !Array.isArray(base[lang])) {
      base[lang] = { ...base[lang], ...value };
    } else {
      base[lang] = value;
    }
  }
  return base;
}

export async function modifyQuestion(id, updates, topic = undefined, examMode = undefined) {
  const collection = getQuestionsCollection();
  const existing = await resolveQuestion(collection, id, { topic, examMode });
  if (!existing) return null;

  const filteredUpdates = Object.fromEntries(
    Object.entries(updates || {}).filter(([key]) => !IMMUTABLE_QUESTION_FIELDS.has(key))
  );
  const normalizedUpdates = normalizeLocalizedQuestion(filteredUpdates);
  const mergedTranslations = normalizedUpdates.translations !== undefined
    ? mergeTranslations(existing.translations, normalizedUpdates.translations)
    : existing.translations;
  const updated = {
    ...existing,
    ...normalizedUpdates,
    ...(mergedTranslations !== undefined ? { translations: mergedTranslations } : {}),
    id: existing.id,
    questionUid: canonicalQuestionUid(existing),
    updatedAt: new Date().toISOString(),
  };
  assertQuestionExamMode(updated, examMode);

  if (!updated.topic) {
    updated.topic =
      existing.topic || updates.chapter || updates.subject || "misc";
  }

  Object.assign(updated, buildNormalizedQuestionFields(updated), trainingQuestionMetadata(updated), battleQuestionMetadata(updated));
  delete updated._id;
  await collection.updateOne(scopedQuestionFilter({ _id: existing._id }, examMode), { $set: updated });
  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();
  await refreshUploadedQuestionMetadata(dedupeScopeQuestions([existing, updated]));
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

async function resolveQuestionsBatch(collection, uniqueIds, examMode, context = {}) {
  const uidIds = [];
  const legacyIds = [];
  for (const id of uniqueIds) {
    if (/^q_[a-f0-9]{32}$/.test(id)) uidIds.push(id);
    else legacyIds.push(id);
  }

  const resolvedMap = new Map();
  const readBatch = async (filter, limit) => {
    let cursor = collection.find(filter);
    if (typeof cursor.project === 'function') {
      cursor = cursor.project({ _id: 1, id: 1, questionUid: 1 });
    }
    if (typeof cursor.limit === 'function' && limit) {
      cursor = cursor.limit(limit);
    }
    return cursor.toArray();
  };

  if (uidIds.length > 0) {
    const uidFilter = scopedQuestionFilter({ questionUid: { $in: uidIds } }, examMode);
    const uidRows = await readBatch(uidFilter, uidIds.length + 1);
    for (const row of uidRows) {
      if (row?._id !== undefined) resolvedMap.set(String(row._id), row._id);
    }
  }

  if (legacyIds.length > 0) {
    const expandedValues = [];
    const seenVal = new Set();
    for (const id of legacyIds) {
      if (!seenVal.has(id)) {
        seenVal.add(id);
        expandedValues.push(id);
      }
      if (Number.isFinite(Number(id))) {
        const numeric = Number(id);
        if (!seenVal.has(numeric)) {
          seenVal.add(numeric);
          expandedValues.push(numeric);
        }
      }
    }
    const baseLegacyFilter = {
      id: { $in: expandedValues },
      ...(context.topic ? { topic: String(context.topic) } : {}),
      ...(context.subject ? { subject: String(context.subject) } : {}),
    };
    const legacyFilter = scopedQuestionFilter(baseLegacyFilter, examMode);
    const legacyRows = await readBatch(legacyFilter, legacyIds.length * 2 + 1);
    const rowsByExactId = new Map();
    for (const row of legacyRows) {
      const key = row?.id !== undefined ? row.id : row?._id;
      if (!rowsByExactId.has(key)) rowsByExactId.set(key, []);
      rowsByExactId.get(key).push(row);
    }
    for (const id of legacyIds) {
      const candidateKeys = [id];
      if (id.trim() && Number.isFinite(Number(id))) {
        const numeric = Number(id);
        if (!candidateKeys.includes(numeric)) candidateKeys.push(numeric);
      }
      const matchedByDocId = new Map();
      for (const candidateKey of candidateKeys) {
        for (const row of rowsByExactId.get(candidateKey) || []) {
          if (row?._id !== undefined) matchedByDocId.set(String(row._id), row);
        }
      }
      const matches = [...matchedByDocId.values()];
      if (matches.length > 1) {
        throw Object.assign(
          new Error('Question ID is ambiguous. Send questionUid or an unambiguous topic.'),
          { statusCode: 409, code: 'AMBIGUOUS_QUESTION_ID' },
        );
      }
      if (matches.length === 1 && matches[0]?._id !== undefined) {
        resolvedMap.set(String(matches[0]._id), matches[0]._id);
      }
    }
  }

  return [...resolvedMap.values()];
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
    const resolved = await resolveQuestionsBatch(collection, uniqueIds, examMode, context);
    if (resolved.length === 0) {
      return { deleted: 0, failed: 0, total: uniqueIds.length };
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
