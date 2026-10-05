export const profileProjection = { _id: 0, ...Object.fromEntries([
  'id', 'name', 'email', 'avatar', 'phone', 'role', 'progress', 'bookmarks', 'bookmarkEntries',
  'studyTime', 'timezone', 'dailyGoalMinutes', 'notificationPreferences', 'dailyPracticeReminder',
  'createdAt', 'updatedAt', ...['quizKey', 'title', 'subject', 'slug', 'href', 'mode', 'currentIndex',
    'totalQuestions', 'status', 'updatedAt', 'questionAnchor', 'sessionFilters'].map(field => `recentQuizzes.${field}`),
].map(field => [field, 1])) };

export function chatSummary({ id, title, updatedAt, messages, revision }) {
  return { id, title, updatedAt, revision: revision ?? messages.length, messageCount: messages.length };
}

export function appendChatMessages(chats, chatId, { title, messages, sequence }) {
  const previous = chats.find(chat => chat.id === chatId);
  const revision = previous?.revision ?? previous?.messages?.length ?? 0;
  const offset = sequence - 1;
  // Retried batches must match the original records; stale writes cannot replace a turn.
  if (offset < revision) {
    const first = revision - (previous?.messages?.length ?? 0);
    if (offset < first || offset + messages.length > revision
      || messages.some((message, i) => {
        const saved = previous.messages[offset - first + i];
        return saved?.role !== message.role || saved?.content !== message.content;
      })) throw Object.assign(new Error('Chat sequence conflict'), { statusCode: 409 });
    return { chats, revision };
  }
  if (offset !== revision) throw Object.assign(new Error('Chat sequence conflict'), { statusCode: 409 });
  const entry = { id: chatId, title: previous?.title || title || 'New chat',
    messages: [...(previous?.messages ?? []), ...messages].slice(-80),
    revision: revision + messages.length, updatedAt: new Date().toISOString() };
  return { chats: [entry, ...chats.filter(chat => chat.id !== chatId)].slice(0, 30), revision: entry.revision };
}

export function mergeQuizEntry(previous, body) {
  if (!body.delta) return { ...previous, ...body, updatedAt: new Date().toISOString() };
  const selectedAnswers = { ...(previous?.selectedAnswers ?? {}), ...body.selectedAnswers };
  for (const index of body.removedAnswers ?? []) delete selectedAnswers[index];
  const submitted = new Set(previous?.submittedQuestions ?? []);
  for (const index of body.submittedQuestions ?? []) submitted.add(index);
  const results = new Map((previous?.results ?? []).map(result => [result.questionIndex, result]));
  for (const result of body.results ?? []) results.set(result.questionIndex, result);
  const { delta, removedAnswers, ...metadata } = body;
  return { ...previous, ...metadata, selectedAnswers, submittedQuestions: [...submitted],
    results: [...results.values()], updatedAt: new Date().toISOString() };
}
