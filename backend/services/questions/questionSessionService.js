import { getQuestionsCollection } from "../../config/mongodb.js";
import { normalizeSearchKey } from "./questionNormalizer.js";
import {
  buildExcludeStudyModeCondition,
  buildModeFilter,
  caseInsensitiveExact,
  combineMongoConditions,
} from "./questionQueryBuilder.js";

export async function fetchQuestionsSession(params) {
  const collection = getQuestionsCollection();
  const { topic, subject, mode, limit = 50, cursor: cursorId, letter, exam, concept } = params;

  const parsedLimit = Math.max(
    1,
    Math.min(5000, Math.floor(Number(limit)) || 50),
  );
  const conditions = [];

  if (topic) {
    const normalizedTopic = normalizeSearchKey(topic);
    const isSynonymAntonymTopic =
      normalizedTopic === "synonymsantonyms" ||
      normalizedTopic === "antosynopyq";
    if (isSynonymAntonymTopic) {
      conditions.push({
        topic: { $in: [topic, "antosynopyq", "synonyms-antonyms"] },
      });
    } else {
      conditions.push(
        process.env.QUESTIONS_NORMALIZED_KEYS === "true"
          ? { topicKey: normalizeSearchKey(topic) }
          : { topic },
      );
    }
  } else if (subject) {
    conditions.push(
      process.env.QUESTIONS_NORMALIZED_KEYS === "true"
        ? { subjectKey: normalizeSearchKey(subject) }
        : { subject: caseInsensitiveExact(subject) },
    );
  }

  if (letter) {
    const lettersArray = letter.split(',').map(l => l.trim()).filter(Boolean);
    if (lettersArray.length > 0) {
      conditions.push({ letter: { $in: lettersArray.map(l => caseInsensitiveExact(l)) } });
    }
  }

  if (exam && exam !== "all") {
    const examsArray = exam.split(',').map(e => e.trim()).filter(Boolean);
    if (examsArray.length > 0) {
      conditions.push({ exam: { $in: examsArray.map(e => caseInsensitiveExact(e)) } });
    }
  }

  if (concept && concept !== "all") {
    const conceptsArray = concept.split(',').map(c => c.trim()).filter(Boolean);
    if (conceptsArray.length > 0) {
      conditions.push({ concept: { $in: conceptsArray.map(c => caseInsensitiveExact(c)) } });
    }
  }

  // Apply mode filter
  if (mode) {
    if (process.env.QUESTIONS_NORMALIZED_KEYS === "true") {
      conditions.push({ modeKey: mode });
    } else {
      const modeFilter = buildModeFilter(mode);
      conditions.push(modeFilter);
    }
  } else {
    // Default: exclude study-mode
    conditions.push(buildExcludeStudyModeCondition());
  }

  // Cursor-based pagination using _id
  if (cursorId) {
    try {
      const { ObjectId } = await import("mongodb");
      conditions.push({ _id: { $gt: new ObjectId(cursorId) } });
    } catch {
      // Invalid cursor, ignore
    }
  }

  const mongoFilter = combineMongoConditions(conditions);

  // Fetch limit + 1 to know if there are more
  const resources = await collection
    .find(mongoFilter)
    .sort({ _id: 1 })
    .limit(parsedLimit + 1)
    .toArray();

  const countFilter = combineMongoConditions(
    conditions.filter((c) => !c._id || !c._id.$gt)
  );
  
  const totalCount = await collection.countDocuments(countFilter);

  const hasMore = resources.length > parsedLimit;
  const pageItems = resources.slice(0, parsedLimit);

  const nextCursor =
    hasMore && pageItems.length > 0
      ? pageItems[pageItems.length - 1]._id.toString()
      : null;

  const questions = pageItems.map(item => {
    const { _id, ...rest } = item;
    return rest;
  });

  return {
    questions,
    nextCursor,
    hasMore,
    totalCount,
  };
}
