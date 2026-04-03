import rawData from "../data/percentages_questions.json";

export interface PercentageQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
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

function normalizeRaw(raw: any, i: number): PercentageQuestion {
  return {
    id: raw.id ?? i + 1,
    concept: raw.concept ?? "Basic Percentages",
    formula: raw.formula ?? "",
    question: raw.question ?? "",
    options: Array.isArray(raw.options) ? raw.options : [],
    correctAnswer: Number.isFinite(raw.correct_option_index) ? raw.correct_option_index : 0,
    answer: String(raw.correct_answer ?? raw.answer ?? ""),
    difficulty: raw.difficulty === "medium" || raw.difficulty === "hard" ? raw.difficulty : "easy",
    estimatedTime: Number(raw.estimatedTime ?? 60),
    year: String(raw.year ?? ""),
    exam: String(raw.exam ?? ""),
  };
}

export const percentagesQuestions: PercentageQuestion[] = (rawData as any[]).map(normalizeRaw);

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
