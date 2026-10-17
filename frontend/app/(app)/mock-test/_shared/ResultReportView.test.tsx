import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ResultReportView from './ResultReportView';
import type { MockAttempt } from './api';

const callbacks = () => ({ onReview: vi.fn(), onRetake: vi.fn(), onBack: vi.fn() });
const data: MockAttempt = {
  result: {
    totalScore: -1.5, maxScore: 200,
    sections: Array.from({ length: 6 }, (_, index) => ({
      key: `section-${index}`, label: `Section ${index + 1}`,
      correct: 0, incorrect: 1, skipped: 24, score: -0.5, maxScore: 50,
    })),
  },
};

it('keeps all sections accessible through pagination and preserves negative scores', () => {
  render(<ResultReportView data={data} {...callbacks()} />);
  expect(screen.getByText('-1.5')).toBeInTheDocument();
  expect(screen.queryByText(/percentile/)).not.toBeInTheDocument();
  expect(screen.getByText('Section 4')).toBeInTheDocument();
  expect(screen.queryByText('Section 5')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous sections' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next sections' }));
  expect(screen.getByText('Section 5')).toBeInTheDocument();
  expect(screen.getByText('Section 6')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next sections' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Previous sections' }));
  expect(screen.getByText('Section 1')).toBeInTheDocument();
});

it('preserves review, retake, all-tests and focus topic actions', () => {
  const actions = callbacks();
  render(<ResultReportView data={{ ...data, weakAreas: ['synonyms-antonyms', 'idioms-phrases'] }} {...actions} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
  fireEvent.click(screen.getByRole('button', { name: 'All tests' }));
  expect(actions.onReview).toHaveBeenCalledOnce();
  expect(actions.onRetake).toHaveBeenCalledOnce();
  expect(actions.onBack).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByRole('combobox', { name: 'Focus on' }), { target: { value: 'idioms-phrases' } });
  expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '/english/idioms-phrases');
});

it('keeps confidential assessment review and retake unavailable', () => {
  render(<ResultReportView data={{ ...data, assessmentMode: 'confidential' }} {...callbacks()} />);
  expect(screen.queryByRole('button', { name: 'Review answers' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retake' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'All tests' })).toBeInTheDocument();
});
