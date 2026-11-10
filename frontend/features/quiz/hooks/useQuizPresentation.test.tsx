import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, render } from '@testing-library/react';
import { useQuizPresentation } from './useQuizPresentation';
import { QuizThemeProvider } from '@/features/quiz/components/QuizThemeProvider';
import type { SubjectConfig } from '@/features/quiz/model/types';

const subjectConfig: SubjectConfig = {
  subjectId: 'english',
  subjectLabel: 'English',
  cssClassName: 'english',
  topicConcepts: {},
  classificationCategories: [],
  getClassificationCategoryId: () => '',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QuizThemeProvider storageKey="presentation-test-theme">
    {children}
  </QuizThemeProvider>
);

describe('useQuizPresentation renderQuestionLine', () => {
  it('renders regular quotes with quote-highlight class', () => {
    const { result } = renderHook(() => useQuizPresentation(subjectConfig), { wrapper });
    const nodes = result.current.renderQuestionLine("Select the synonym of 'abandon'.");
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toBe("Select the synonym of 'abandon'.");
    const highlight = container.querySelector('.quote-highlight');
    expect(highlight).not.toBeNull();
    expect(highlight?.textContent).toBe("'abandon'");
  });

  it('renders bold question text (**bold**)', () => {
    const { result } = renderHook(() => useQuizPresentation(subjectConfig), { wrapper });
    const nodes = result.current.renderQuestionLine("Which of the following sentences is in **passive voice**?");
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toBe('Which of the following sentences is in passive voice?');
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('passive voice');
  });

  it('renders bold around single quotes (**\'word\'**)', () => {
    const { result } = renderHook(() => useQuizPresentation(subjectConfig), { wrapper });
    const nodes = result.current.renderQuestionLine("Select the antonym of **'abrupt'**.");
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toBe("Select the antonym of 'abrupt'.");
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    const highlight = strong?.querySelector('.quote-highlight');
    expect(highlight).not.toBeNull();
    expect(highlight?.textContent).toBe("'abrupt'");
  });

  it('renders bold inside single quotes (\'**word**\')', () => {
    const { result } = renderHook(() => useQuizPresentation(subjectConfig), { wrapper });
    const nodes = result.current.renderQuestionLine("Select the antonym of '**abrupt**'.");
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toBe("Select the antonym of 'abrupt'.");
    const highlight = container.querySelector('.quote-highlight');
    expect(highlight).not.toBeNull();
    const strong = highlight?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('abrupt');
  });

  it('renders double underscore bold (__bold__)', () => {
    const { result } = renderHook(() => useQuizPresentation(subjectConfig), { wrapper });
    const nodes = result.current.renderQuestionLine("Identify the __grammatical error__ in the sentence.");
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toBe('Identify the grammatical error in the sentence.');
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('grammatical error');
  });
});
