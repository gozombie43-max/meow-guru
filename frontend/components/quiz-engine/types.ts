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
