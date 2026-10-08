import 'fake-indexeddb/auto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { seedStartResponse } from '@/lib/start-response-cache';
import type { TrainingSession } from '../../training-types';
import { clearPendingTrainingAction, readPendingTrainingAction, readTrainingSnapshot, savePendingTrainingAction, saveTrainingSnapshot } from '../offlineTraining';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), replace: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'offline-user' } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
import { useTrainingSession } from './useTrainingSession';

it('cancels a superseded session GET and ignores its late response', async () => {
  let release!: (value: { data: TrainingSession }) => void;
  mocks.get.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const hook = renderHook(({ sessionId }) => useTrainingSession(sessionId), { initialProps: { sessionId: id } });
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  const signal = mocks.get.mock.calls[0][1].signal as AbortSignal;
  const next = { ...saved, id: crypto.randomUUID() };
  mocks.get.mockResolvedValue({ data: next });
  hook.rerender({ sessionId: next.id });
  await waitFor(() => expect(hook.result.current.session?.id).toBe(next.id));
  expect(signal.aborted).toBe(true);
  await act(async () => release({ data: saved }));
  expect(hook.result.current.session?.id).toBe(next.id);
});

let id: string;
let saved: TrainingSession;
const pending = () => ({ key: 'saved-action-123', body: { type: 'answer' as const, choice: 1, confidence: 'sure' as const, revision: 2 }, expiresAt: Date.now() + 86400000 });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_OFFLINE_TRAINING', 'true');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  id = crypto.randomUUID();
  saved = { id, revision: 2, status: 'active', current: 0, questions: [{ id: 'q1' }], answers: {}, serverNow: Date.now(), deadline: new Date(Date.now() + 3600000).toISOString() } as TrainingSession;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('replays the saved idempotency key before reading authoritative state, even with a create handoff', async () => {
  seedStartResponse('training', 'offline-user', id, saved);
  await savePendingTrainingAction('offline-user', id, pending());
  mocks.post.mockResolvedValue({ data: {} });
  mocks.get.mockImplementation(async () => {
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`/api/training/sessions/${id}/actions?response=delta`, pending().body, expect.objectContaining({ headers: { 'Idempotency-Key': pending().key } }));
    expect(await readPendingTrainingAction('offline-user', id)).toBeNull();
    return { data: { ...saved, revision: 3, answers: { q1: { choice: 1, confidence: 'sure', seconds: 5 } } } };
  });
  const hook = renderHook(() => useTrainingSession(id));
  await waitFor(() => expect(hook.result.current.session?.revision).toBe(3));
  expect(hook.result.current.choice).toBe(1);
  expect(hook.result.current.error).toBe('');
});

it('restores a snapshot offline and synchronizes the pending action on reconnect', async () => {
  await saveTrainingSnapshot('offline-user', saved);
  await savePendingTrainingAction('offline-user', id, pending());
  mocks.post.mockRejectedValue(new Error('Connection lost'));
  const hook = renderHook(() => useTrainingSession(id));
  await waitFor(() => expect(hook.result.current.error).toContain('last saved session'));
  expect(hook.result.current.session?.revision).toBe(2);
  expect(mocks.get).not.toHaveBeenCalled();
  expect((await readPendingTrainingAction('offline-user', id))?.key).toBe(pending().key);
  mocks.post.mockResolvedValue({ data: {} });
  mocks.get.mockResolvedValue({ data: { ...saved, revision: 3 } });
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(hook.result.current.session?.revision).toBe(3));
  expect(mocks.post.mock.calls.map(call => call[2].headers['Idempotency-Key'])).toEqual([pending().key, pending().key]);
  await waitFor(async () => expect((await readTrainingSnapshot('offline-user', id))?.revision).toBe(3));
});

it('clears definitively rejected actions and asks the learner to review fresh state', async () => {
  await savePendingTrainingAction('offline-user', id, pending());
  mocks.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { error: 'Revision changed' } } });
  mocks.get.mockResolvedValue({ data: { ...saved, revision: 4 } });
  const hook = renderHook(() => useTrainingSession(id));
  await waitFor(() => expect(hook.result.current.session?.revision).toBe(4));
  expect(hook.result.current.error).toContain('saved action was rejected');
  expect(await readPendingTrainingAction('offline-user', id)).toBeNull();
});

it('keeps ambiguous outcomes pending and saves offline answers without grading them', async () => {
  mocks.get.mockResolvedValue({ data: saved });
  const hook = renderHook(() => useTrainingSession(id));
  await waitFor(() => expect(hook.result.current.session?.revision).toBe(2));
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(async () => hook.result.current.act({ type: 'answer', choice: 1, confidence: 'sure' }));
  const action = await readPendingTrainingAction('offline-user', id);
  expect(action?.body.revision).toBe(2);
  expect(mocks.post).not.toHaveBeenCalled();
  expect(hook.result.current.session?.answers).toEqual({});
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  mocks.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'IDEMPOTENCY_PENDING' } } });
  await act(async () => hook.result.current.reload());
  expect((await readPendingTrainingAction('offline-user', id))?.key).toBe(action?.key);
  expect(hook.result.current.session?.revision).toBe(2);
  await clearPendingTrainingAction('offline-user', id, action!.key);
});

it('hydrates a new session without GET, preserves time sync, and reloads authoritatively', async () => {
  const receivedAt = Date.now() - 5000;
  const now = vi.spyOn(Date, 'now').mockReturnValue(receivedAt);
  seedStartResponse('training', 'offline-user', id, saved);
  now.mockReturnValue(receivedAt + 5000);
  mocks.get.mockResolvedValue({ data: { ...saved, revision: 3 } });
  const hook = renderHook(() => useTrainingSession(id), { wrapper: StrictMode });
  await waitFor(() => expect(hook.result.current.session?.revision).toBe(2));
  expect(mocks.get).not.toHaveBeenCalled();
  expect(hook.result.current.timeSync.receivedAt).toBe(receivedAt);
  await act(async () => hook.result.current.reload());
  expect(mocks.get).toHaveBeenCalledOnce();
  expect(hook.result.current.session?.revision).toBe(3);
});

it('fetches on revisit after the creation handoff has been consumed', async () => {
  seedStartResponse('training', 'offline-user', id, saved);
  mocks.get.mockResolvedValue({ data: { ...saved, revision: 3 } });
  const initial = renderHook(() => useTrainingSession(id));
  await waitFor(() => expect(initial.result.current.session?.revision).toBe(2));
  initial.unmount();
  const revisit = renderHook(() => useTrainingSession(id));
  await waitFor(() => expect(revisit.result.current.session?.revision).toBe(3));
  expect(mocks.get).toHaveBeenCalledOnce();
});
