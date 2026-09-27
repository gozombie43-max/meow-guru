import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileQuestionNavigator } from '../views/MobileQuestionNavigator';

describe('question palette pagination', () => {
  it('loads without navigating or closing and disables repeat clicks while loading', () => {
    const props: React.ComponentProps<typeof MobileQuestionNavigator> = {
      activeRailBtnRef: { current: null }, closePalette: vi.fn(), currentIndex: 0,
      goToQuestion: vi.fn(), hideQuestionNumbers: true, isPaletteOpen: true,
      questions: [], selectedAnswers: {}, submittedQuestions: new Set<number>(),
      hasMore: true, isFetchingMore: false, fetchMore: vi.fn().mockResolvedValue(undefined),
    };
    const view = render(<MobileQuestionNavigator {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load more questions' }));
    expect(props.fetchMore).toHaveBeenCalledTimes(1);
    expect(props.closePalette).not.toHaveBeenCalled();
    expect(props.goToQuestion).not.toHaveBeenCalled();
    view.rerender(<MobileQuestionNavigator {...props} isFetchingMore />);
    const loading = screen.getByRole('button', { name: 'Loading…' });
    expect(loading).toBeDisabled();
    fireEvent.click(loading);
    expect(props.fetchMore).toHaveBeenCalledTimes(1);
    view.rerender(<MobileQuestionNavigator {...props} hasMore={false} />);
    expect(screen.queryByRole('button', { name: 'Load more questions' })).not.toBeInTheDocument();
  });
});
