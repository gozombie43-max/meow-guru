import api from './axios';

export const updateProgress = (token: string, topic: string, attempted: number, correct: number) =>
  api.patch('/users/me/progress', { topic, attempted, correct }, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const toggleBookmark = (token: string, questionId: string, action: 'add' | 'remove') =>
  api.patch('/users/me/bookmarks', { questionId, action }, {
    headers: { Authorization: `Bearer ${token}` },
  });