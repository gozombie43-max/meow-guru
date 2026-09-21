import { mockAnswerIndex } from "../../mockAnswer.js";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function normalizeQuestion(q) {
  if (
    !Array.isArray(q.options) ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(String(q.id || "")) ||
    ["__proto__", "constructor", "prototype"].includes(q.id)
  )
    return null;
  const options = (q.options || []).map((o) =>
    typeof o === "string" ? o : o?.text,
  );
  const correctIndex = mockAnswerIndex(q.correctAnswer, q.options);
  const text = q.question || q.questionText;
  if (
    !q.id ||
    !text ||
    options.length < 2 ||
    options.length > 6 ||
    options.some((o) => typeof o !== "string" || !o.trim()) ||
    new Set(options.map((o) => o.trim().toLocaleLowerCase())).size !== options.length ||
    correctIndex === null
  )
    return null;
  if (q.sourceType === "ai-generated" && q.validationStatus !== "validated")
    return null;
  const difficulty =
    typeof q.difficulty === "number"
      ? clamp(q.difficulty, 1, 5)
      : { easy: 1, medium: 2, hard: 3, extreme: 4, nightmare: 5 }[
          String(q.difficulty).toLowerCase()
        ] || 2;
  const examName = [q.examName, q.exam, ...(Array.isArray(q.exams) ? q.exams : [q.exams])]
    .find(value => typeof value === "string" && value.trim())?.trim() || null;
  const examYears = [...new Set(examName?.match(/\b(?:19|20)\d{2}\b/g) || [])];
  return {
    id: String(q.id),
    text: String(text),
    options,
    correctIndex,
    solution: String(q.solution || q.explanation || ""),
    image: q.questionImage || q.image || "",
    subject: String(q.subject || "Unclassified"),
    topic: String(q.topic || q.questionTopic || "Unclassified"),
    subtopic: String(q.subtopic || q.chapter || ""),
    concepts: Array.isArray(q.concepts) ? q.concepts : [],
    difficulty,
    expectedTime: clamp(Number(q.expectedTime) || 60, 10, 600),
    targetSource: q.expectedTime ? "catalog" : "baseline",
    sourceType: q.sourceType || (q.year ? "pyq" : "bank"),
    examName,
    year: q.year || (examYears.length === 1 ? examYears[0] : null),
    shift: q.shift || null,
    discrimination: clamp(Number(q.discrimination) || 0, 0, 1),
  };
}
