// frontend/lib/trigonometryQuestions.ts

/* ── Types ──────────────────────────────────────────────── */

export interface TrigonometryQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  options: string[];
  correctAnswer: number;   // 0-based index into options[]
  answer: string;           // original answer text
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: number;    // seconds
  year: string;
  exam: string;
  solution?: string;        // step-by-step solution
  questionType?: string;
  questionImage?: string;
  optionRegions?: Record<string, { x: number; y: number; w: number; h: number }>;
  correctLetter?: string;
}

export const TRIG_CONCEPTS = [
  "Trigonometric Ratios & Values",
  "Trigonometric Identities",
  "Height & Distance",
  "Trigonometric Equations",
  "Graphs & Periodicity",
  "Complementary Angles",
  "Simplification",
] as const;

export type TrigConcept = (typeof TRIG_CONCEPTS)[number];
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}