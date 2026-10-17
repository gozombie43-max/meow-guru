import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { getAttempt, type MockAttempt } from './api';
import ReviewEngine from './ReviewEngine';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'test-token', user: { id: 'review-user' }, loading: false }) }));
vi.mock('./api', () => ({ getAttempt: vi.fn() }));

const attempt: MockAttempt = {
  paper: { examName: 'SSC CHSL Tier I', schemaDriven: true, sections: [
    { key: 'math', label: 'Math', questions: [
      { id: 'q1', question: 'First question', options: ['A', 'B'], solution: 'First explanation', translations: { question: { en: 'First question', bn: 'প্রথম প্রশ্ন' }, options: { en: ['A', 'B'], bn: ['ক', 'খ'] }, solution: { en: 'First explanation', bn: 'প্রথম ব্যাখ্যা' } } },
      { id: 'q2', question: 'Second question', options: ['A', 'B'] },
    ] },
    { key: 'english', label: 'English', questions: [{ id: 'q3', question: 'English question', options: ['A', 'B'] }] },
  ] }, answers: {}, answerKey: { q1: '0', q2: '0', q3: '0' },
};

beforeEach(() => { vi.clearAllMocks(); vi.mocked(getAttempt).mockResolvedValue(attempt); });
async function mount() {
  render(<ReviewEngine examSlug="ssc-chsl" testId="test" attemptId="attempt" />);
  await screen.findByText('First question');
}

it('shows an empty state for a filter with no matches instead of an unrelated question', async () => {
  await mount();
  fireEvent.change(screen.getByRole('combobox', { name: 'Show' }), { target: { value: 'correct' } });
  expect(screen.getByRole('heading', { name: 'No correct questions' })).toBeInTheDocument();
  expect(screen.queryByText('First question')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Show all questions' }));
  expect(screen.getByText('First question')).toBeInTheDocument();
});

it('supports next, previous, section selection and returning to results', async () => {
  await mount();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Second question')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getByText('First question')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Section' }), { target: { value: '1' } });
  expect(screen.getByText('English question')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
  expect(router.replace).toHaveBeenCalledWith('/mock-test/ssc-chsl/test/result/attempt');
});

it('switches question, options and explanation language together', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'বাংলা' }));
  expect(screen.getByText('প্রথম প্রশ্ন')).toBeInTheDocument();
  expect(screen.getByText('প্রথম ব্যাখ্যা')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'বাংলা' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps confidential answers unavailable', async () => {
  vi.mocked(getAttempt).mockResolvedValue({ ...attempt, assessmentMode: 'confidential' });
  render(<ReviewEngine examSlug="ssc-chsl" testId="test" attemptId="attempt" />);
  await waitFor(() => expect(screen.getByText('Answer review is disabled for this confidential assessment.')).toBeInTheDocument());
  expect(screen.queryByText('First question')).not.toBeInTheDocument();
});

it('typesets inline, display and multiline math in questions, options and translated explanations', async () => {
  const explanation = String.raw`\[
\begin{aligned}
x^2 &= 4 \\
x &= \pm 2
\end{aligned}
\]`;
  vi.mocked(getAttempt).mockResolvedValue({
    ...attempt,
    paper: { ...attempt.paper!, sections: [{ key: 'math', label: 'Math', questions: [{
      id: 'math-q',
      question: String.raw`Evaluate \(\frac{1}{2}+\sqrt{9}\).`,
      options: [String.raw`$\begin{pmatrix}1&2\\3&4\end{pmatrix}$`, String.raw`\(a=3, b=-\frac{3}{2}\)`],
      solution: explanation,
      translations: { question: { en: String.raw`Evaluate \(\frac{1}{2}+\sqrt{9}\).`, bn: String.raw`মান \(\frac{1}{2}\)` }, options: { en: [String.raw`$\begin{pmatrix}1&2\\3&4\end{pmatrix}$`, String.raw`\(a=3, b=-\frac{3}{2}\)`], bn: [String.raw`\(\frac{3}{2}\)`, String.raw`\(\sqrt{2}\)`] }, solution: { en: explanation, bn: String.raw`সমাধান \[\sum_{n=1}^{3} n = 6\]` } },
    }] }] },
  });
  const { container } = render(<ReviewEngine examSlug="ssc-chsl" testId="test" attemptId="attempt" />);
  await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(4));
  expect(container.querySelector('.katex-error')).toBeNull();
  expect(container.querySelectorAll('.katex-mathml mtable')).toHaveLength(2);
  container.querySelectorAll('.katex-mathml mtable').forEach(table => expect(table.querySelectorAll('mtr')).toHaveLength(2));
  expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'বাংলা' }));
  await waitFor(() => expect(container.textContent).toContain('সমাধান'));
  await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(4));
  expect(container.querySelector('.katex-error')).toBeNull();
});
