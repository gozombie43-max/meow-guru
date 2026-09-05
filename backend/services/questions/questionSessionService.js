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
  const { topic, subject, mode, limit = 50, cursor: cursorId, letter } = params;

  const parsedLimit = Math.max(
    1,
    Math.min(100, Math.floor(Number(limit)) || 50),
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
    conditions.push({ letter: caseInsensitiveExact(letter) });
  }

  // Apply mode filter
  if (mode) {
    const modeFilter = buildModeFilter(mode);
    conditions.push(modeFilter);
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
    .project({ _id: 1 }) // first pass: get IDs to check hasMore
    .sort({ _id: 1 })
    .limit(parsedLimit + 1)
    .toArray();

  const hasMore = resources.length > parsedLimit;
  const resultIds = resources.slice(0, parsedLimit).map((r) => r._id);

  // Second pass: get full documents for the page
  const questions =
    resultIds.length > 0
      ? await collection
          .find({ _id: { $in: resultIds } })
          .project({ _id: 0 })
          .sort({ _id: 1 })
          .toArray()
      : [];

  const nextCursor =
    hasMore && resultIds.length > 0
      ? resultIds[resultIds.length - 1].toString()
      : null;

  return {
    questions,
    nextCursor,
    hasMore,
  };
}
