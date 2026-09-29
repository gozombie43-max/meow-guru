import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MobileQuizHeader } from '../views/MobileQuizChrome';

vi.mock('@/components/LangToggle', () => ({ LangToggle: () => null }));
afterEach(cleanup);
const props: React.ComponentProps<typeof MobileQuizHeader> = {
  routeBase: '/mathematics/percentages',
  subjectConfig: { subjectId: 'mathematics', subjectLabel: 'Math', cssClassName: 'math', topicConcepts: {}, classificationCategories: [], getClassificationCategoryId: () => '' },
  slug: 'percentages', activeLang: 'en', currentIndex: 6, hideQuestionNumbers: true,
  isSettingsOpen: false, isTranslating: false, openPalette: vi.fn(), setActiveLang: vi.fn(), setIsSettingsOpen: vi.fn(),
  questions: Array.from({ length: 100 }, (_, id) => ({ id, concept: '', formula: '', question: '', options: [], correctAnswer: 0, answer: '', difficulty: 'easy', estimatedTime: 30, year: '', exam: '', solution: '' })),
  hasMore: true, availableCount: 250,
};

it('uses the saved exact total, independently of loaded pages', () => {
  const view = render(<MobileQuizHeader {...props} />);
  expect(screen.getByRole('button', { name: 'Question 7 of 250 - Open question navigator' })).toHaveTextContent('7 / 250');
  view.rerender(<MobileQuizHeader {...props} availableCount={100} hasMore={false} />);
  expect(screen.getByRole('button', { name: 'Question 7 of 100 - Open question navigator' })).toHaveTextContent('7 / 100');
});

it('does not invent a total or imply infinity while metadata is unavailable', () => {
  render(<MobileQuizHeader {...props} availableCount={0} />);
  expect(screen.getByRole('button', { name: 'Question 7 - Open question navigator' })).toHaveTextContent('Question 7');
});
