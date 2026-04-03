import rawData from "../data/algebra_questions.json";

export interface AlgebraQuestion {
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

export const CONCEPTS = [
  "Algebraic Identities",
  "Quadratic Equations",
  "Simplification",
  "Surds & Indices",
  "Polynomials",
  "Linear Equations",
  "Factorization",
] as const;

export type Concept = (typeof CONCEPTS)[number];

function normalizeRaw(raw: any, i: number): AlgebraQuestion {
  return {
    id: raw.id ?? i + 1,
    concept: raw.concept ?? "Simplification",
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

export const algebraQuestions: AlgebraQuestion[] = (rawData as any[]).map(normalizeRaw);

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
