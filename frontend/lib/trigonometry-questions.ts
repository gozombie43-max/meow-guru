// Trigonometry questions loader for quiz engine
import trigonometryQuestionsData from "@/data/trigonometry_questions.json";

export interface TrigonometryQuestion {
  id: number;
  text: string;
  options: string[];
  correct: string; // 'a', 'b', 'c', 'd'
  exam?: string;
}

export const trigonometryQuestions: TrigonometryQuestion[] = trigonometryQuestionsData;

// Helper to get correct answer index (0-3)
export function getCorrectAnswerIndex(q: TrigonometryQuestion): number {
  const map = { a: 0, b: 1, c: 2, d: 3 };
  return map[q.correct] ?? 0;
}
