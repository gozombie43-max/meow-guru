import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as Auth from '@/context/AuthContext';
import DashboardPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
const user = { id: 'u1', name: 'Test Student', email: 'student@example.test', progress: { math: { attempted: 20, correct: 15 } }, studyTime: 3900, bookmarks: ['q1'], recentQuizzes: [
  { quizKey: 'done', title: 'Completed quiz', subject: 'English', href: '/english/quiz', status: 'completed' as const, updatedAt: '2026-10-09' },
  { quizKey: 'resume', title: 'Percentages', subject: 'Mathematics', href: '/mathematics/arithmetic/percentages/quiz?exam=SSC', mode: 'practice', currentIndex: 4, totalQuestions: 20, status: 'in-progress' as const, updatedAt: '2026-10-08' },
] };
beforeEach(() => {
  vi.spyOn(Auth, 'useAuth').mockReturnValue({ user, loading: false, token: 'test', login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(), updateProfile: vi.fn() });
});
it('shows actual totals and resumes the latest unfinished session with its filters', () => {
  render(<DashboardPage />);
  const stats = within(screen.getByLabelText('Study totals'));
  for (const value of ['20', '75%', '1h 5m', '1']) expect(stats.getByText(value)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Resume practice' })).toHaveAttribute('href', '/mathematics/arithmetic/percentages/quiz?exam=SSC&mode=practice&resume=1');
  expect(screen.getByText('Mathematics · Question 5 of 20')).toBeInTheDocument();
});
it('shows honest empty states and working subject links for a new user', () => {
  vi.mocked(Auth.useAuth).mockReturnValue({ ...Auth.useAuth(), user: { ...user, progress: {}, bookmarks: [], recentQuizzes: [], studyTime: 0 } });
  render(<DashboardPage />);
  expect(screen.getByText('Your progress starts here')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start practicing' })).toHaveAttribute('href', '/play');
  expect(screen.getByRole('link', { name: /Mathematics.*Numbers/ })).toHaveAttribute('href', '/mathematics');
});

