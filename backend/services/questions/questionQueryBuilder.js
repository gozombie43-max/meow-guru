import { normalizeQuizKey, normalizeSearchKey } from "./questionNormalizer.js";

export function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function caseInsensitiveExact(value) {
  return new RegExp(`^${escapeRegex(String(value ?? "").trim())}$`, "i");
}

export function combineMongoConditions(conditions) {
  if (!conditions.length) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

export function mongoString(field) {
  return {
    $trim: {
      input: {
        $convert: {
          input: field,
          to: "string",
          onError: "",
          onNull: "",
        },
      },
    },
  };
}

export function questionModeAggregation(match) {
  return [
    { $match: match },
    {
      $project: {
        quizName: { $toLower: mongoString("$quizName") },
        quizId: { $toLower: mongoString("$quizId") },
        source: { $toLower: mongoString("$source") },
        questionType: { $toLower: mongoString("$questionType") },
        topic: { $toLower: mongoString("$topic") },
        hasLetter: { $ne: [mongoString("$letter"), ""] },
        hasWord: { $ne: [mongoString("$word"), ""] },
        hasMeanings: { $isArray: "$meanings" },
      },
    },
    {
      $group: {
        _id: {
          quizName: "$quizName",
          quizId: "$quizId",
          source: "$source",
          questionType: "$questionType",
          topic: "$topic",
          hasLetter: "$hasLetter",
          hasWord: "$hasWord",
          hasMeanings: "$hasMeanings",
        },
        count: { $sum: 1 },
      },
    },
  ];
}

export function questionModeFromAggregateKey(key = {}) {
  const quizTag = normalizeQuizKey(key.quizName || key.quizId || key.source);
  const normalizedTopic = normalizeSearchKey(key.topic);
  const questionType = String(key.questionType || "")
    .trim()
    .toLowerCase();
  const quizName = String(key.quizName || "")
    .trim()
    .toLowerCase();

  if (
    questionType === "study-mode" ||
    questionType === "studymode" ||
    quizName === "study mode" ||
    (key.hasWord && key.hasMeanings)
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
    key.hasLetter ||
    key.hasWord
  ) {
    return "formula";
  }

  if (["selectionway", "aichallenge"].includes(quizTag)) return "aiChallenge";
  if (["tier2", "tier2hard"].includes(quizTag)) return "hard";
  if (quizTag === "topicmix") return "easy";
  if (["pw", "mixedpractice", "mixedpw"].includes(quizTag)) return "mixed";
  return "concept";
}

export function matchesQuizNameFilter(question, normalizedQuizName) {
  if (!normalizedQuizName) return true;

  const candidates = [question.quizName, question.quizId, question.source];

  const matched = candidates.some(
    (value) => normalizeQuizKey(value) === normalizedQuizName,
  );

  if (normalizedQuizName === "pyq") {
    return (
      matched ||
      question.quizName === undefined ||
      question.quizName === null ||
      question.quizName === ""
    );
  }

  return matched;
}

export function buildStudyModeMatchCondition() {
  return {
    $or: [
      { questionType: { $regex: /^study-?mode$/i } },
      { quizName: { $regex: /^study\s*mode$/i } },
      {
        $and: [
          { word: { $exists: true, $ne: "" } },
          { meanings: { $type: "array" } },
        ],
      },
    ],
  };
}

export function buildExcludeStudyModeCondition() {
  return {
    $nor: [
      { questionType: { $regex: /^study-?mode$/i } },
      { quizName: { $regex: /^study\s*mode$/i } },
      {
        $and: [
          { word: { $exists: true, $ne: "" } },
          { meanings: { $type: "array" } },
        ],
      },
    ],
  };
}

export const MODE_QUIZ_TAGS = {
  formula: [
    "careerwill",
    "patternbank",
    "formula",
    "formulabank",
    "vocabularybank",
    "factbank",
    "antosynopyq",
  ],
  "ai-challenge": ["selectionway", "aichallenge"],
  hard: ["tier2", "tier2hard"],
  easy: ["topicmix"],
  mixed: ["pw", "mixedpractice", "mixedpw"],
};

export function buildModeFilter(mode) {
  const requested = String(mode || "concept");
  const canonical = requested === "ai-challenge" || requested === "aiChallenge" ? "aiChallenge" : requested;
  // Match the same normalized quiz tags used during ingestion without requiring
  // a database backfill or MongoDB's unsupported $regexReplace operator.
  const tagPattern = tags => `^[^a-z0-9]*(?:${tags.map(tag => tag.split("").join("[^a-z0-9]*")).join("|")})[^a-z0-9]*$`;
  const firstTag = { $cond: [
    { $ne: [mongoString("$quizName"), ""] }, mongoString("$quizName"),
    { $cond: [{ $ne: [mongoString("$quizId"), ""] }, mongoString("$quizId"), mongoString("$source")] },
  ] };
  const tagMatches = tags => ({ $regexMatch: { input: firstTag, regex: tagPattern(tags), options: "i" } });
  const hasWord = { $ne: [mongoString("$word"), ""] };
  const hasLetter = { $ne: [mongoString("$letter"), ""] };
  const modeExpression = { $switch: { branches: [
    { case: { $or: [
      { $regexMatch: { input: mongoString("$questionType"), regex: "^study-?mode$", options: "i" } },
      { $regexMatch: { input: mongoString("$quizName"), regex: "^study mode$", options: "i" } },
      { $and: [hasWord, { $isArray: "$meanings" }] },
    ] }, then: "studyMode" },
    { case: { $or: [tagMatches(MODE_QUIZ_TAGS.formula), hasWord, hasLetter,
      { $regexMatch: { input: mongoString("$topic"), regex: tagPattern(["antosynopyq"]), options: "i" } },
    ] }, then: "formula" },
    { case: tagMatches(MODE_QUIZ_TAGS["ai-challenge"]), then: "aiChallenge" },
    { case: tagMatches(MODE_QUIZ_TAGS.hard), then: "hard" },
    { case: tagMatches(MODE_QUIZ_TAGS.easy), then: "easy" },
    { case: tagMatches(MODE_QUIZ_TAGS.mixed), then: "mixed" },
  ], default: "concept" } };
  return { $expr: { $eq: [modeExpression, canonical] } };
}
