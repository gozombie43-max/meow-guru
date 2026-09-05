import crypto from "crypto";
import pLimit from "p-limit";
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

  const { _id, ...resource } = item;
  return resource;
}

export async function createQuestionsBulk(questionsData) {
  const collection = getQuestionsCollection();

  const normalizedQuestions = questionsData.map((q, idx) => {
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

    return Object.assign(item, normalizedQuestionKeys(item));
  });

  const buildNewId = (idx, attempt = 0) => {
    const suffix = crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(8).toString("hex");
    return `q_${Date.now()}_${idx}_${attempt}_${suffix}`;
  };

  const createWithRetry = async (item, idx) => {
    let current = { ...item };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await collection.insertOne(current);
        return current;
      } catch (err) {
        if (err?.code !== 11000) throw err;
        current = { ...current, id: buildNewId(idx, attempt + 1) };
      }
    }

    current = { ...current, id: buildNewId(idx, 99) };
    await collection.insertOne(current);
    return current;
  };

  const writeLimit = pLimit(10);
  const results = await Promise.allSettled(
    normalizedQuestions.map((q, idx) =>
      writeLimit(() => createWithRetry(q, idx)),
    ),
  );
  questionsQueryCache.clear();
  questionCountsCache.clear();
  return results;
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
