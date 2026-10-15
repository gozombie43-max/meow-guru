import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBattle } from './useBattle';

const fixture = vi.hoisted(() => {
  const listeners = new Map<string, (...args: never[]) => void>();
  const socket = { connected: true, emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
  return { listeners, socket };
});
vi.mock('@/lib/socket', () => ({ getSocket: () => fixture.socket }));
const deliver = (event: string, payload?: unknown) => act(() => { fixture.listeners.get(event)?.(payload as never); });

describe('battle socket controller', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); fixture.listeners.clear();
    fixture.socket.on.mockImplementation((name, handler) => { fixture.listeners.set(name, handler); return fixture.socket; });
    fixture.socket.off.mockReturnValue(fixture.socket);
    fixture.socket.connect.mockReturnValue(fixture.socket); fixture.socket.disconnect.mockReturnValue(fixture.socket);
  });

  it('enters, restores, and cancels the queue without retaining a mutation timeout', () => {
    const { result } = renderHook(() => useBattle('token', 'me'));
    deliver('battle:resumeResult', { reason: 'no-room' });
    act(() => result.current.matchmake({ subject: 'iit-jam-physics', topic: 'all', questionCount: 10 }));
    expect(fixture.socket.emit).toHaveBeenCalledWith('matchmaking:join', { subject: 'iit-jam-physics', topic: 'all', questionCount: 10 });
    deliver('matchmaking:queued', { queuedAt: '2026-10-15T00:00:00Z', rating: 1200, subject: 'iit-jam-physics', topic: 'all', questionCount: 10 });
    expect(result.current.state.phase).toBe('queueing'); expect(result.current.pending).toBeNull();
    act(() => { vi.advanceTimersByTime(13_000); });
    expect(result.current.connection).toBe('online');
    expect(fixture.socket.emit).toHaveBeenLastCalledWith('battle:resume', { code: null });
    act(() => result.current.cancelMatchmaking());
    expect(fixture.socket.emit).toHaveBeenCalledWith('matchmaking:cancel', {});
    deliver('matchmaking:cancelled');
    expect(result.current.state.phase).toBe('lobby');
  });

  it('recovers a pair claimed during cancellation through the server snapshot', () => {
    const { result } = renderHook(() => useBattle('token', 'me'));
    deliver('battle:resumeResult', { reason: 'no-room' });
    deliver('matchmaking:matched', { roomCode: '7K4P9Q' });
    expect(localStorage.getItem('meow_active_battle_code:me')).toBe('7K4P9Q');
    expect(fixture.socket.emit).toHaveBeenLastCalledWith('battle:resume', { code: '7K4P9Q' });
    deliver('matchmaking:error', { code: 'RESUME_REQUIRED' });
    expect(result.current.connection).toBe('syncing');
    deliver('battle:resumed', { code: '7K4P9Q', status: 'waiting', mode: 'ranked', origin: 'matchmaking', subject: 'mathematics', topic: 'all', questionCount: 10, scores: {}, players: [], currentQuestion: null, myAnswered: false });
    expect(result.current.state).toMatchObject({ phase: 'waiting', mode: 'ranked', origin: 'matchmaking' });
    expect(result.current.connection).toBe('online');
  });

  it('keeps correctness unknown until reveal and applies scores with the reveal', () => {
    const { result } = renderHook(() => useBattle('token', 'me'));
    deliver('battle:resumeResult', { reason: 'no-room' });
    deliver('game:start', { scores: { me: { name: 'Me', score: 0, answered: false }, rival: { name: 'Rival', score: 0, answered: false } } });
    deliver('game:question', { question: '2 + 2?', options: ['3', '4'], questionIndex: 0, total: 10, deadline: null });
    act(() => result.current.submitAnswer(1));
    deliver('game:answerResult', { questionIndex: 0, accepted: true, isCorrect: true });
    expect(result.current.state.answerStatus).toBe('accepted'); expect(result.current.state.correct).toBeNull();
    deliver('game:opponentAnswered', { questionIndex: 0, userId: 'rival', answered: true });
    expect(result.current.state.scores.rival).toMatchObject({ score: 0, answered: true });
    deliver('game:reveal', { questionIndex: 0, correctIndex: 1, selections: { me: 1, rival: 0 }, scores: { me: { name: 'Me', score: 10, answered: true }, rival: { name: 'Rival', score: 0, answered: true } } });
    expect(result.current.state.correct).toBe(true); expect(result.current.state.scores.me.score).toBe(10);
    deliver('game:question', { question: 'Next?', options: ['A', 'B'], questionIndex: 1, total: 10, deadline: null });
    expect(result.current.state.correct).toBeNull(); expect(result.current.state.answerStatus).toBe('idle');
  });
});
