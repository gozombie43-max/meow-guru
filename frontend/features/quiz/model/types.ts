/**
 * Shared types for the unified QuizEngine component.
 * Each subject provides a SubjectConfig to parametrize the engine.
 */

export interface SubjectConfig {
  /** API subject identifier, e.g. "reasoning", "mathematics" */
  subjectId: string;
  /** Human-readable label, e.g. "Reasoning", "Mathematics" */
  subjectLabel: string;
  /** CSS class prefix for theme scoping, e.g. "reasoning-quiz" */
  cssClassName: string;
  /** Label for the "formula" quiz mode. Defaults to "Pattern Practice" */
  formulaModeLabel?: string;
  modeLabels?: Partial<Record<QuizMode, string>>;
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

import type { GeometryDiagram } from '@/components/geometry/diagramSchema';

export interface LocalizedQuestionContent {
  question?: string;
  options?: string[];
  solution?: string;
}

export interface QuizQuestion {
  id: number | string;
  sessionAnchor?: string;
  sessionPlaceholder?: boolean;
  questionImageWidth?: number;
  questionImageHeight?: number;
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
  questionUid?: string;
  diagram?: GeometryDiagram;
  needs_diagram?: boolean;
  translations?: {
    bn?: LocalizedQuestionContent;
    hi?: LocalizedQuestionContent;
  };
}

export interface SessionResult {
  questionId: string | number;
  questionUid?: string;
  questionIndex: number;
  selected: number | null;
  correct: number;
  isCorrect: boolean;
  timeTaken: number;
  concept: string;
  difficulty: Difficulty;
}

export type QuizTheme = "light" | "dark";

export interface ClassificationGroup {
  readonly id: string;
  readonly label: string;
  readonly accent: string;
  readonly bg: string;
  concepts: string[];
}
