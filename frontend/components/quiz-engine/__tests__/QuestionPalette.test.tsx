import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionPalettePanel, QuestionPaletteModal } from '../ui/QuestionPalette';
import { QuizQuestion } from '../types';

const mockQuestions: QuizQuestion[] = [
  {
    id: 1,
    concept: 'Triangles',
    formula: '',
    question: 'Q1',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    answer: 'A',
    difficulty: 'easy',
    estimatedTime: 40,
    year: '2023',
    exam: 'SSC CGL',
    solution: 'Sol 1',
  },
  {
    id: 2,
    concept: 'Circles',
    formula: '',
    question: 'Q2',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 1,
    answer: 'B',
    difficulty: 'medium',
    estimatedTime: 60,
    year: '2023',
    exam: 'SSC CGL',
    solution: 'Sol 2',
  },
];

describe('QuestionPalette Component', () => {
  it('renders question palette panel buttons', () => {
    const onGoTo = vi.fn();
    render(
      <QuestionPalettePanel
        total={2}
        currentIndex={0}
        selectedAnswers={{}}
        questions={mockQuestions}
        submittedQuestions={new Set()}
        onGoToQuestion={onGoTo}
      />
    );

    expect(screen.getByText('1/2')).toBeDefined();
    const btn1 = screen.getByText('1');
    const btn2 = screen.getByText('2');
    expect(btn1).toBeDefined();
    expect(btn2).toBeDefined();

    fireEvent.click(btn2);
    expect(onGoTo).toHaveBeenCalledWith(2);
  });

  it('renders modal when isOpen is true and triggers onClose', () => {
    const onGoTo = vi.fn();
    const onClose = vi.fn();
    render(
      <QuestionPaletteModal
        isOpen={true}
        total={2}
        currentIndex={0}
        selectedAnswers={{ 0: 0 }}
        questions={mockQuestions}
        submittedQuestions={new Set([0])}
        onClose={onClose}
        onGoToQuestion={onGoTo}
      />
    );

    expect(screen.getAllByText('Question Palette').length).toBeGreaterThan(0);
    const closeBtn = screen.getByLabelText('Close question palette');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
