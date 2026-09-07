import api from './axios';
import { announceFeedback } from './feedback';

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
  }).then((response) => {
    announceFeedback(action === 'add' ? 'Bookmark added' : 'Bookmark removed');
    return response;
  });

export const saveRecentQuiz = (token: string, payload: RecentQuizPayload) =>
  api.patch('/users/me/recent-quizzes', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

export interface NotificationPreferences {
  enabled: boolean;

  battleInvites: boolean;
  battleResults: boolean;

  dailyPractice: boolean;
  newMocks: boolean;
  examUpdates: boolean;

  announcements: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get('/users/me/notification-preferences');
  return data.preferences;
}

export async function updateNotificationPreferences(
  update: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await api.patch('/users/me/notification-preferences', update);
  return data.preferences;
}

export interface DailyPracticeReminder {
  enabled: boolean;
  time: string;
  timezone: string | null;
  nextSendAt: string | null;
  lastSentAt: string | null;
  streakProtectionEnabled?: boolean;
  streakProtectionTime?: string;
  nextStreakProtectionAt?: string | null;
  lastStreakProtectionSentAt?: string | null;
}

export async function getDailyPracticeReminder(): Promise<DailyPracticeReminder> {
  const { data } = await api.get('/users/me/daily-practice-reminder');
  return data.reminder;
}

export async function updateDailyPracticeReminder(settings: {
  enabled: boolean;
  time: string;
  timezone: string;
  streakProtectionEnabled?: boolean;
  streakProtectionTime?: string;
}): Promise<DailyPracticeReminder> {
  const { data } = await api.patch('/users/me/daily-practice-reminder', settings);
  return data.reminder;
}

export async function getStudyGoal(): Promise<{ dailyGoalMinutes: number }> {
  const { data } = await api.get('/users/me/study-goal');
  return data;
}

export async function updateStudyGoal(
  dailyGoalMinutes: number
): Promise<{ ok: boolean; dailyGoalMinutes: number }> {
  const { data } = await api.patch('/users/me/study-goal', {
    dailyGoalMinutes,
  });
  return data;
}