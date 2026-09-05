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

// Versioned ingestion keys. Keep display fields and legacy lookup semantics intact.
export function normalizedQuestionKeys(question) {
  return {
    topicKey: normalizeSearchKey(question.topic),
    subjectKey: normalizeSearchKey(question.subject || question.quizSubject),
    quizKey: normalizeQuizKey(
      question.quizName || question.quizId || question.source,
    ),
    keyVersion: 1,
  };
}
