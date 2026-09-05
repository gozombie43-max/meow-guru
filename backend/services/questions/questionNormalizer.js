export function normalizeSearchKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeQuizKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function matchesNormalizedTopic(question, normalizedTopic) {
  const candidates = [
    question.topic,
    question.chapter,
    question.subject,
    question.quizTopic,
    question.quizName,
    question.source,
  ];
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
  return {
    topicKey: normalizeSearchKey(question.topic),
    subjectKey: normalizeSearchKey(question.subject || question.quizSubject),
    quizKey: normalizeQuizKey(
      question.quizName || question.quizId || question.source,
    ),
    modeKey: deriveModeKey(question),
    keyVersion: 1,
  };
}
