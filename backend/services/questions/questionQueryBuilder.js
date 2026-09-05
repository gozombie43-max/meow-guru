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
  const normalizedMode = String(mode || "")
    .trim()
    .toLowerCase();
  const tags = MODE_QUIZ_TAGS[normalizedMode];
  if (!tags) {
    // "concept" mode = everything NOT matched by other modes
    const allOtherTags = Object.values(MODE_QUIZ_TAGS).flat();
    const tagRegexes = allOtherTags.map(
      (t) => new RegExp(`^${escapeRegex(t)}$`, "i"),
    );
    return {
      $and: [
        buildExcludeStudyModeCondition(),
        {
          $nor: [
            { quizName: { $in: tagRegexes } },
            { quizId: { $in: tagRegexes } },
            { source: { $in: tagRegexes } },
          ],
        },
      ],
    };
  }

  const tagRegexes = tags.map((t) => new RegExp(`^${escapeRegex(t)}$`, "i"));

  if (normalizedMode === "formula") {
    // Formula mode also includes records with letter fields, but excludes study mode
    return {
      $and: [
        buildExcludeStudyModeCondition(),
        {
          $or: [
            { quizName: { $in: tagRegexes } },
            { quizId: { $in: tagRegexes } },
            { source: { $in: tagRegexes } },
            { topic: { $regex: /^antosynopyq$/i } },
            { letter: { $exists: true, $ne: "" } },
          ],
        },
      ],
    };
  }

  return {
    $and: [
      buildExcludeStudyModeCondition(),
      {
        $or: [
          { quizName: { $in: tagRegexes } },
          { quizId: { $in: tagRegexes } },
          { source: { $in: tagRegexes } },
        ],
      },
    ],
  };
}
