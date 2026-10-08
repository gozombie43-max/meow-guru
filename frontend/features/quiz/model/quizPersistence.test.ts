import { beforeEach, expect, it, vi } from 'vitest';
import { createResumeSaver } from './resumeDelta';
import type { RecentQuizPayload, QuizAnswerCommand } from '@/lib/userApi';

const mocks = vi.hoisted(() => ({ answer: vi.fn(), checkpoint: vi.fn() }));
vi.mock('@/lib/userApi', () => ({ submitQuizAnswer: mocks.answer, saveRecentQuiz: mocks.checkpoint }));
vi.mock('@/lib/axios', () => ({ getAccessToken: () => 'token', AUTH_TOKEN_CHANGED_EVENT: 'auth-token-changed' }));
const snapshot = (index = 0): RecentQuizPayload => ({ quizKey: 'math:algebra', title: 'Algebra', subject: 'math', href: '/quiz',
  currentIndex: index, mode: 'concept', selectedAnswers: { 0: 1 }, submittedQuestions: [0],
  results: [{ questionIndex: 0, selected: 1, isCorrect: true }], status: 'in-progress' });
const answer = (overrides = {}): Omit<QuizAnswerCommand, 'resume'> => ({ questionId: 'q', answer: 1,
  submissionId: 'submission_key_1', questionIndex: 0, timeTaken: 10, ...overrides });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => { vi.clearAllMocks(); mocks.answer.mockResolvedValue({}); mocks.checkpoint.mockResolvedValue({}); });

it('sends one command and suppresses the equivalent delayed history save', async () => {
  const saver = createResumeSaver('token', 'quiz');
  await saver.answer(answer(), snapshot());
  await saver.save(structuredClone(snapshot()));
  expect(mocks.answer).toHaveBeenCalledTimes(1); expect(mocks.checkpoint).not.toHaveBeenCalled();
  await saver.save(snapshot(1));
  expect(mocks.checkpoint).toHaveBeenCalledTimes(1);
  expect(mocks.checkpoint.mock.calls[0][1]).toMatchObject({ delta: true, currentIndex: 1, selectedAnswers: {}, submittedQuestions: [], results: [] });
});
it('freezes input and submission key after an uncertain outcome before retrying', async () => {
  mocks.answer.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValue({});
  const saver = createResumeSaver('token', 'quiz');
  await expect(saver.answer(answer(), snapshot())).rejects.toThrow('Lost response');
  await saver.save(snapshot(1));
  expect(mocks.answer).toHaveBeenCalledTimes(2);
  expect(mocks.answer.mock.calls[1][0]).toBe(mocks.answer.mock.calls[0][0]);
  expect(mocks.checkpoint.mock.calls[0][1]).toMatchObject({ currentIndex: 1, selectedAnswers: {}, submittedQuestions: [] });
});
it('orders independent answer commands and sends only the second resume delta', async () => {
  const wait = deferred(); mocks.answer.mockReturnValueOnce(wait.promise);
  const saver = createResumeSaver('token', 'quiz');
  const first = saver.answer(answer(), snapshot());
  const next = { ...snapshot(1), selectedAnswers: { 0: 1, 1: 0 }, submittedQuestions: [0, 1], results: [...snapshot().results!, { questionIndex: 1 }] };
  const second = saver.answer(answer({ submissionId: 'submission_key_2', questionIndex: 1, answer: 0 }), next);
  const checkpoint = saver.save(next);
  await Promise.resolve(); await Promise.resolve(); expect(mocks.answer).toHaveBeenCalledTimes(1);
  wait.resolve(); await Promise.all([first, second, checkpoint]);
  expect(mocks.answer.mock.calls[1][0].resume).toMatchObject({ delta: true, selectedAnswers: { 1: 0 }, submittedQuestions: [1] });
  expect(mocks.checkpoint).not.toHaveBeenCalled();
});
it('does not let an older checkpoint overwrite an answer queued while it waits', async () => {
  const wait = deferred(); mocks.answer.mockReturnValueOnce(wait.promise);
  const saver = createResumeSaver('token', 'quiz');
  const first = saver.answer(answer(), snapshot());
  const stale = saver.save(snapshot(1));
  const next = { ...snapshot(1), selectedAnswers: { 0: 1, 1: 0 }, submittedQuestions: [0, 1], results: [...snapshot().results!, { questionIndex: 1 }] };
  const second = saver.answer(answer({ submissionId: 'submission_key_2', questionIndex: 1, answer: 0 }), next);
  wait.resolve(); await Promise.all([first, stale, second]);
  expect(mocks.checkpoint).not.toHaveBeenCalled();
});
it('aborts in-flight commands and queued checkpoints on logout/account change', async () => {
  const wait = deferred(); mocks.answer.mockReturnValueOnce(wait.promise);
  const saver = createResumeSaver('token', 'quiz');
  const first = saver.answer(answer(), snapshot()); await Promise.resolve(); await Promise.resolve();
  window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: 'another-owner' }));
  expect(mocks.answer.mock.calls[0][1].aborted).toBe(true);
  wait.resolve(); await first;
  await expect(saver.save(snapshot(1))).rejects.toHaveProperty('name', 'AbortError');
  expect(mocks.checkpoint).not.toHaveBeenCalled();
});
