export interface NavigationQuestionSeed {
  id: number;
  number: number;
  answered: boolean;
  markedForReview: boolean;
}

// Example dataset for stress testing 300-400 question navigation UIs.
export const EXAMPLE_377_QUESTIONS: NavigationQuestionSeed[] = Array.from(
  { length: 377 },
  (_, index) => ({
    id: index + 1,
    number: index + 1,
    answered: false,
    markedForReview: false,
  }),
);
