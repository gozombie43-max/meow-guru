import api from './axios';

export interface RecentQuizPayload {
  quizKey: string;
  title: string;
  subject: string;
  slug?: string;
  href: string;
  mode?: string;
  currentIndex?: number;
  totalQuestions?: number;
  selectedAnswers?: Record<number, number>;
  submittedQuestions?: number[];
  results?: unknown[];
  status?: 'in-progress' | 'completed';
}

export interface BookmarkMeta {
  quizKey?: string;
  title?: string;
  subject?: string;
  slug?: string;
  href?: string;
  mode?: string;
  questionIndex?: number;
}

export const updateProgress = (token: string, topic: string, attempted: number, correct: number) =>
  api.patch('/users/me/progress', { topic, attempted, correct }, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const toggleBookmark = (
  token: string,
  questionId: string,
  action: 'add' | 'remove',
  meta?: BookmarkMeta
) =>
  api.patch('/users/me/bookmarks', { questionId, action, meta }, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const saveRecentQuiz = (token: string, payload: RecentQuizPayload) =>
  api.patch('/users/me/recent-quizzes', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });