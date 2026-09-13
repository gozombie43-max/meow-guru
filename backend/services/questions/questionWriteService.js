import crypto from "crypto";
import { invalidateQuestionMetadata } from "./questionMetadataCache.js";
import { refreshUploadedQuestionMetadata } from "./questionMetadataService.js";
import { getQuestionsCollection } from "../../config/mongodb.js";
import { questionCountsCache, questionsQueryCache } from "./questionCache.js";
import { normalizedQuestionKeys } from "./questionNormalizer.js";

export async function createQuestion(newQuestion) {
  const collection = getQuestionsCollection();
  const item = { ...newQuestion };

  if (!item.topic) {
    item.topic = item.chapter || item.subject || item.category || "misc";
  }
  item.topic = String(item.topic).trim() || "misc";

  Object.assign(item, normalizedQuestionKeys(item));
  await collection.insertOne(item);
  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();

  await refreshUploadedQuestionMetadata([item]);

  const { _id, ...resource } = item;
  return resource;
}

export async function createQuestionsBulk(questionsData, { importId } = {}) {
  const collection = getQuestionsCollection();
  const invalid = new Set();

  const normalizedQuestions = questionsData.map((q, idx) => {
    if (!q || typeof q !== 'object' || Array.isArray(q)) { invalid.add(idx); return null; }
    const item = q && typeof q === "object" ? { ...q } : { value: q };

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
    return Object.assign(item, normalizedQuestionKeys(item));
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

export async function modifyQuestion(id, updates, topic = undefined) {
  const collection = getQuestionsCollection();
  const filter = { id: String(id) };

  if (topic !== undefined && topic !== "") {
    filter.topic = topic;
  }

  const existing = await collection.findOne(filter);
  if (!existing) return null;

  const updated = { ...existing, ...updates, id: existing.id };
  delete updated._id;

  if (!updated.topic) {
    updated.topic =
      existing.topic || updates.chapter || updates.subject || "misc";
  }

  Object.assign(updated, normalizedQuestionKeys(updated));
  await collection.updateOne({ _id: existing._id }, { $set: updated });
  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();
  await refreshUploadedQuestionMetadata([existing, updated]);
  return updated;
}

export async function removeQuestion(id, topic = undefined) {
  const collection = getQuestionsCollection();
  const filter = { id: String(id) };

  if (topic !== undefined && topic !== "") {
    filter.topic = topic;
  }

  const result =
    topic !== undefined && topic !== ""
      ? await collection.deleteOne(filter)
      : await collection.deleteMany(filter);

  questionsQueryCache.clear();
  questionCountsCache.clear();
  await invalidateQuestionMetadata();
  return result.deletedCount > 0;
}

export async function removeQuestionsBulk(ids) {
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
    const result = await collection.deleteMany({ id: { $in: uniqueIds } });
    questionsQueryCache.clear();
    questionCountsCache.clear();
    await invalidateQuestionMetadata();

    return {
      deleted: result.deletedCount,
      failed: 0,
      total: uniqueIds.length,
    };
  } catch (err) {
    console.error("removeQuestionsBulk error:", err);

    return {
      deleted: 0,
      failed: uniqueIds.length,
      total: uniqueIds.length,
    };
  }
}

export async function checkDuplicates(questions) {
  const collection = getQuestionsCollection();

  const ids = questions
    .map((q) => String(q.id || q._id || q.questionId || ""))
    .filter(Boolean);

  const getQuestionText = (q) =>
    String(q?.question ?? q?.questionText ?? q?.q ?? "").trim();
  const incomingTexts = questions.map(getQuestionText).filter(Boolean);
  const uniqueIds = Array.from(new Set(ids));
  const uniqueTexts = Array.from(new Set(incomingTexts));

  if (uniqueIds.length === 0 && uniqueTexts.length === 0) {
    return [];
  }

  const existingMap = new Map();

  if (uniqueIds.length > 0) {
    const existingById = await collection
      .find({ id: { $in: uniqueIds } })
      .project({
        _id: 0,
        id: 1,
        question: 1,
        questionText: 1,
      })
      .toArray();

    for (const r of existingById) {
      existingMap.set(String(r.id), r.question || r.questionText || "");
    }
  }

  const textBatchSize = 50;
  const existingTextMap = new Map();

  for (let i = 0; i < uniqueTexts.length; i += textBatchSize) {
    const batch = uniqueTexts.slice(i, i + textBatchSize);
    const existingByText = await collection
      .find({
        $or: [{ question: { $in: batch } }, { questionText: { $in: batch } }],
      })
      .project({
        _id: 0,
        id: 1,
        question: 1,
        questionText: 1,
      })
      .toArray();

    for (const r of existingByText) {
      const dbText = String(r.question || r.questionText || "").trim();
      if (dbText) existingTextMap.set(dbText, r.id);
    }
  }

  const duplicates = [];
  questions.forEach((q, index) => {
    const qId = String(q.id || q._id || q.questionId || "");
    const qText = getQuestionText(q);

    if (qId && existingMap.has(qId)) {
      duplicates.push({ index, id: qId, reason: "Duplicate ID" });
    } else if (qText && existingTextMap.has(qText)) {
      duplicates.push({
        index,
        id: qId,
        matchedId: existingTextMap.get(qText),
        reason: "Duplicate Question Text",
      });
    }
  });

  return duplicates;
}
