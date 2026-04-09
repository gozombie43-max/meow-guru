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

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
