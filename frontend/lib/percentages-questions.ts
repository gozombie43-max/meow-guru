import rawData from "../data/percentages_questions.json";

export interface PercentageQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  solution: string;
  options: string[];
  correctAnswer: number;
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: number;
  year: string;
  exam: string;
}

export const PERCENTAGE_CONCEPTS = [
  "Basic Percentages",
  "Profit & Loss",
  "Discounts",
  "Statistics With Percentage",
  "Compound Interest",
] as const;

type RawPercentageQuestion = {
  id?: number;
  concept?: string;
  formula?: string;
  question?: string;
  text?: string;
  solution?: unknown;
  options?: unknown;
  correct_option_index?: number;
  correct?: string | number;
  correct_answer?: string;
  answer?: string;
  difficulty?: string;
  estimatedTime?: number;
  year?: string;
  exam?: string;
};

function collectRawQuestions(source: unknown, acc: RawPercentageQuestion[]) {
  if (Array.isArray(source)) {
    source.forEach((item) => collectRawQuestions(item, acc));
    return;
  }

  if (source && typeof source === "object") {
    acc.push(source as RawPercentageQuestion);
  }
}

function flattenRawQuestions(source: unknown): RawPercentageQuestion[] {
  const acc: RawPercentageQuestion[] = [];
  collectRawQuestions(source, acc);
  return acc;
}

function inferConcept(question: string): PercentageQuestion["concept"] {
  const q = question.toLowerCase();

  if (
    q.includes("compound interest") ||
    q.includes("simple interest") ||
    q.includes("interest") ||
    /\bci\b/.test(q)
  ) {
    return "Compound Interest";
  }

  if (q.includes("discount") || q.includes("marked price")) {
    return "Discounts";
  }

  if (
    q.includes("profit") ||
    q.includes("loss") ||
    q.includes("cost price") ||
    q.includes("selling price")
  ) {
    return "Profit & Loss";
  }

  if (
    q.includes("average") ||
    q.includes("mean") ||
    q.includes("median") ||
    q.includes("mode") ||
    q.includes("weighted")
  ) {
    return "Statistics With Percentage";
  }

  return "Basic Percentages";
}

function toCorrectOptionIndex(raw: RawPercentageQuestion, options: string[]): number {
  if (Number.isInteger(raw.correct_option_index)) {
    const idx = Number(raw.correct_option_index);
    return idx >= 0 && idx < options.length ? idx : 0;
  }

  if (typeof raw.correct === "number" && Number.isFinite(raw.correct)) {
    const idx = Number(raw.correct);
    if (idx >= 0 && idx < options.length) return idx;
    if (idx >= 1 && idx <= options.length) return idx - 1;
  }

  if (typeof raw.correct === "string") {
    const normalized = raw.correct.trim().toLowerCase();
    const letters = ["a", "b", "c", "d", "e", "f"];
    const byLetter = letters.indexOf(normalized);
    if (byLetter >= 0 && byLetter < options.length) return byLetter;

    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0 && numeric < options.length) return numeric;
      if (numeric >= 1 && numeric <= options.length) return numeric - 1;
    }
  }

  if (typeof raw.correct_answer === "string") {
    const answerIdx = options.findIndex(
      (opt) => opt.trim() === raw.correct_answer?.trim()
    );
    if (answerIdx >= 0) return answerIdx;
  }

  if (typeof raw.answer === "string") {
    const answerIdx = options.findIndex((opt) => opt.trim() === raw.answer?.trim());
    if (answerIdx >= 0) return answerIdx;
  }

  return 0;
}

function extractYear(exam: string): string {
  const yearMatch = exam.match(/\b(19|20)\d{2}\b/);
  return yearMatch?.[0] ?? "";
}

function normalizeRaw(raw: RawPercentageQuestion, i: number): PercentageQuestion {
  const question = String(raw.question ?? raw.text ?? "");
  const options = Array.isArray(raw.options) ? raw.options.map((opt) => String(opt)) : [];
  const correctAnswer = toCorrectOptionIndex(raw, options);
  const exam = String(raw.exam ?? "");

  return {
    id: raw.id ?? i + 1,
    concept: raw.concept ?? inferConcept(question),
    formula: raw.formula ?? "",
    question,
    solution: String(raw.solution ?? ""),
    options,
    correctAnswer,
    answer: String(
      raw.correct_answer ??
        raw.answer ??
        (options.length > 0 ? options[correctAnswer] ?? "" : "")
    ),
    difficulty: raw.difficulty === "medium" || raw.difficulty === "hard" ? raw.difficulty : "easy",
    estimatedTime: Number(raw.estimatedTime ?? 60),
    year: String(raw.year ?? extractYear(exam)),
    exam,
  };
}

export const percentagesQuestions: PercentageQuestion[] = flattenRawQuestions(rawData)
  .map(normalizeRaw)
  .filter((q) => q.question.trim().length > 0 && q.options.length >= 2);

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
