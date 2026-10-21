import { fireEvent, render, screen, within } from '@testing-library/react';
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
  expect(screen.queryByRole('button', { name: 'Review Section 1' })).not.toBeInTheDocument();
});

it('distinguishes accuracy from score percentage and opens the selected section', () => {
  const actions = callbacks();
  render(<ResultReportView data={{ result: { totalScore: 3.5, maxScore: 8, percentage: 43.75, sections: [{ key: 'math', label: 'Math', total: 4, correct: 2, incorrect: 1, skipped: 1, score: 3.5, maxScore: 8 }] } }} {...actions} />);
  expect(within(screen.getByRole('region', { name: 'Performance overview' })).getByText('66.7%')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Score percentage: 43.8%' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review Math' }));
  expect(actions.onReview).toHaveBeenCalledWith('math');
});

it('shows unavailable accuracy for an unattempted paper and keeps retake errors recoverable', () => {
  render(<ResultReportView data={{ result: { totalScore: 0, maxScore: 200, sections: [{ key: 'math', correct: 0, incorrect: 0, skipped: 25, maxScore: 50 }] } }} {...callbacks()} retakePending actionError="Paper unavailable. Try again." />);
  expect(within(screen.getByRole('region', { name: 'Performance overview' })).getByText('—')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Paper unavailable. Try again.');
});
