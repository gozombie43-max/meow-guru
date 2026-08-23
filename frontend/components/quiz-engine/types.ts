/**
 * Shared types for the unified QuizEngine component.
 * Each subject provides a SubjectConfig to parametrize the engine.
 */

export interface ClassificationCategory {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly accent: string;
  readonly bg: string;
  readonly border: string;
}

export interface SubjectConfig {
  /** API subject identifier, e.g. "reasoning", "mathematics" */
  subjectId: string;
  /** Human-readable label, e.g. "Reasoning", "Mathematics" */
  subjectLabel: string;
  /** CSS class prefix for theme scoping, e.g. "reasoning-quiz" */
  cssClassName: string;
  /** Topic slug → concept labels mapping */
  topicConcepts: Record<string, string[]>;
  /** Label for the "formula" quiz mode. Defaults to "Pattern Practice" */
  formulaModeLabel?: string;
  /** Classification categories for concept filter UI */
  classificationCategories: readonly ClassificationCategory[];
  /** Classify a concept string into one of the category IDs */
  getClassificationCategoryId: (concept: string) => string;
}

export type QuizMode =
  | "concept"
  | "formula"
  | "mixed"
  | "ai-challenge"
  | "easy"
  | "hard";

export type Difficulty = "easy" | "medium" | "hard";

export type QuizQuestionRecord = QuizQuestion & {
  quizName?: string;
  source?: string;
  quizId?: string;
};

export type ConceptColour = { border: string; bg: string; text: string };

export interface QuizQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  options: string[];
  correctAnswer: number;
  answer: string;
  difficulty: Difficulty;
  estimatedTime: number;
  year: string;
  exam: string;
  solution: string;
  questionType?: string;
  questionImage?: string;
  optionRegions?: Record<string, { x: number; y: number; w: number; h: number }>;
  correctLetter?: string;
  word?: string;
  letter?: string;
  chapter?: string;
  rawId?: string;
  diagram?: any;
  needs_diagram?: boolean;
}

export interface SessionResult {
  questionId: number;
  questionIndex: number;
  selected: number | null;
  correct: number;
  isCorrect: boolean;
  timeTaken: number;
  concept: string;
  difficulty: Difficulty;
}

export type QuizTheme = "light" | "dark";

export type ClassificationGroup = ClassificationCategory & {
  concepts: string[];
};
