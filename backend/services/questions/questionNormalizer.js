import { createHash } from "node:crypto";
import { getGeneralAwarenessGroupTopicKeys } from "./generalAwarenessTopics.js";

const EXAM_MODE_ROUTING_FIELDS = [
  "subject",
  "quizSubject",
  "topic",
  "quizTopic",
  "exam",
  "subjectId",
  "topicId",
];
const EXAM_MODE_JAM_PATTERN = /^iit[-_\s]*jam(?:[-_\s]|$)/i;

export function normalizeFilterKey(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function parseYearInt(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1900 && value <= 2100 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([12]\d{3})$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return parsed >= 1900 && parsed <= 2100 ? parsed : null;
}

export function parseShiftInt(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 32) return null;
  let rest = trimmed.toLowerCase();
  if (rest.startsWith("shift")) {
    rest = rest.slice(5).trimStart();
    if (rest.startsWith("-") || rest.startsWith(":")) {
      rest = rest.slice(1).trimStart();
    }
  }
  if (!/^(?:[1-9]|10)$/.test(rest)) return null;
  return Number.parseInt(rest, 10);
}

export function deriveExamModeKey(question) {
  if (!question || typeof question !== "object") return "ssc";
  const isJam = EXAM_MODE_ROUTING_FIELDS.some((field) => {
    const raw = question[field];
    const values = Array.isArray(raw) ? raw : [raw];
    return values.some(
      (entry) =>
        (typeof entry === "string" || typeof entry === "number") &&
        EXAM_MODE_JAM_PATTERN.test(String(entry).trim()),
    );
  });
  return isJam ? "iit-jam" : "ssc";
}

export function deriveSelectionKey(question) {
  const seed =
    question?.questionUid ||
    question?.ingestionKey ||
    (question?._id !== undefined && question?._id !== null ? String(question._id) : "") ||
    (question?.id !== undefined && question?.id !== null ? String(question.id) : "");
  return createHash("sha256")
    .update(`selection:v1:${seed}`)
    .digest("hex")
    .slice(0, 16);
}

export function normalizeSearchKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export const normalizeQuizKey = normalizeSearchKey;

export function matchesNormalizedTopic(question, normalizedTopic) {
  const candidates = [
    question.topic,
    question.chapter,
    question.chapterSlug,
    question.topicGroup,
    question.subject,
    question.quizTopic,
    question.quizName,
    question.source,
  ];
  const gaGroupKeys = getGeneralAwarenessGroupTopicKeys(normalizedTopic);
  if (gaGroupKeys.length > 0) {
    const gaKeySet = new Set(gaGroupKeys);
    if (candidates.some((field) => gaKeySet.has(normalizeSearchKey(field)))) {
      return true;
    }
  }
  if (
    normalizedTopic === "synonymsantonyms" ||
    normalizedTopic === "antosynopyq"
  ) {
    if (
      candidates.some((field) => {
        const k = normalizeSearchKey(field);
        return (
          k === "synonymsantonyms" ||
          k === "antosynopyq" ||
          k === "synonyms" ||
          k === "antonyms"
        );
      })
    ) {
      return true;
    }
  }
  if (normalizedTopic === "interest") {
    if (
      candidates.some((field) => {
        const k = normalizeSearchKey(field);
        return (
          k === "interest" ||
          k === "simpleinterest" ||
          k === "compoundinterest"
        );
      })
    ) {
      return true;
    }
  }
  if (normalizedTopic === "simpleinterest") {
    if (
      candidates.some((field) => {
        const k = normalizeSearchKey(field);
        if (k === "simpleinterest") return true;
        if (k === "interest") {
          const text = String(question.question || question.text || "").toLowerCase();
          return !text.includes("compound");
        }
        return false;
      })
    ) {
      return true;
    }
  }
  if (normalizedTopic === "compoundinterest") {
    if (
      candidates.some((field) => {
        const k = normalizeSearchKey(field);
        if (k === "compoundinterest") return true;
        if (k === "interest") {
          const text = String(question.question || question.text || "").toLowerCase();
          return text.includes("compound");
        }
        return false;
      })
    ) {
      return true;
    }
  }
  return candidates.some(
    (field) => normalizeSearchKey(field) === normalizedTopic,
  );
}

export function isStudyModeRecord(q) {
  if (!q || typeof q !== "object") return false;
  const qType = String(q.questionType || "")
    .trim()
    .toLowerCase();
  if (qType === "study-mode" || qType === "studymode") return true;
  if (
    String(q.quizName || "")
      .trim()
      .toLowerCase() === "study mode"
  )
    return true;
  if (typeof q.word === "string" && q.word.trim() && Array.isArray(q.meanings))
    return true;
  return false;
}

export function deriveModeKey(question) {
  if (!question || typeof question !== "object") return "concept";
  const quizTag = normalizeQuizKey(question.quizName || question.quizId || question.source);
  const normalizedTopic = normalizeSearchKey(question.topic);
  const questionType = String(question.questionType || "").trim().toLowerCase();
  const quizName = String(question.quizName || "").trim().toLowerCase();

  const hasWord = !!(question.word && String(question.word).trim());
  const hasLetter = !!(question.letter && String(question.letter).trim());
  const hasMeanings = Array.isArray(question.meanings);

  if (
    questionType === "study-mode" ||
    questionType === "studymode" ||
    quizName === "study mode" ||
    (hasWord && hasMeanings)
  ) {
    return "studyMode";
  }

  if (
    [
      "careerwill",
      "patternbank",
      "formula",
      "formulabank",
      "vocabularybank",
      "factbank",
      "antosynopyq",
    ].includes(quizTag) ||
    normalizedTopic === "antosynopyq" ||
    hasLetter ||
    hasWord
  ) {
    return "formula";
  }

  if (["selectionway", "aichallenge"].includes(quizTag)) return "aiChallenge";
  if (["tier2", "tier2hard"].includes(quizTag)) return "hard";
  if (quizTag === "topicmix") return "easy";
  if (["pw", "mixedpractice", "mixedpw"].includes(quizTag)) return "mixed";
  return "concept";
}

// Versioned ingestion keys. Keep display fields and legacy lookup semantics intact.
export function normalizedQuestionKeys(question) {
  const q = question && typeof question === "object" ? question : {};
  return {
    topicKey: normalizeSearchKey(q.topic),
    subjectKey: normalizeSearchKey(q.subject || q.quizSubject),
    quizKey: normalizeQuizKey(
      q.quizName || q.quizId || q.source,
    ),
    modeKey: deriveModeKey(q),
    keyVersion: 1,
  };
}

// Extended normalized filter & selection keys populated on write and migration 027.
export function buildNormalizedQuestionFields(question) {
  return {
    ...normalizedQuestionKeys(question),
    examKey: normalizeFilterKey(question?.exam),
    conceptKey: normalizeFilterKey(question?.concept),
    chapterKey: normalizeFilterKey(question?.chapter || question?.chapterSlug),
    topicGroupKey: normalizeFilterKey(question?.topicGroup),
    examModeKey: deriveExamModeKey(question),
    yearInt: parseYearInt(question?.year),
    shiftInt: parseShiftInt(question?.shift),
    selectionKey: deriveSelectionKey(question),
  };
}
