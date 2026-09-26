import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { useEffect, type ReactNode } from 'react';
import ApplicationProviders from './providers';
import { invalidateQuestionQueries } from '@/features/quiz/api/questionWrites';

const state = vi.hoisted(() => ({ user: { id: 'first' } as { id: string } | null, loading: false }));
vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: state.user, loading: state.loading }),
}));

beforeEach(() => { state.user = { id: 'first' }; state.loading = false; });

describe('application query ownership', () => {
  it('keeps the page mounted during initial auth restoration and waits to fetch', async () => {
    state.user = null;
    state.loading = true;
    const mount = vi.fn();
    const fetcher = vi.fn(async () => state.user?.id ?? 'guest');
    function Probe() {
      useEffect(() => { mount(); }, []);
      const { data } = useSWR('/private-profile', fetcher);
      return <span>{data ?? 'loading'}</span>;
    }
    const { rerender } = render(<ApplicationProviders><Probe /></ApplicationProviders>);
    expect(fetcher).not.toHaveBeenCalled();
    state.user = { id: 'first' };
    state.loading = false;
    rerender(<ApplicationProviders><Probe /></ApplicationProviders>);
    await screen.findByText('first');
    expect(mount).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('starts paginated queries once after bootstrap', async () => {
    state.user = null;
    state.loading = true;
    const fetcher = vi.fn(async () => ['question']);
    function Probe() {
      const { data } = useSWRInfinite(index => `/page/${index}`, fetcher);
      return <span>{data?.flat().join(',') ?? 'loading'}</span>;
    }
    const { rerender } = render(<ApplicationProviders><Probe /></ApplicationProviders>);
    expect(fetcher).not.toHaveBeenCalled();
    state.user = { id: 'first' };
    state.loading = false;
    rerender(<ApplicationProviders><Probe /></ApplicationProviders>);
    await screen.findByText('question');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/page/0');
  });

  it('discards private cache when the account changes or logs out', async () => {
    const fetcher = vi.fn(async () => state.user?.id ?? 'guest');
    function Probe() {
      const { data } = useSWR('/private-profile', fetcher);
      return <span>{data ?? 'loading'}</span>;
    }
    const { rerender } = render(<ApplicationProviders><Probe /></ApplicationProviders>);
    await screen.findByText('first');
    state.user = { id: 'second' };
    rerender(<ApplicationProviders><Probe /></ApplicationProviders>);
    expect(screen.queryByText('first')).toBeNull();
    await screen.findByText('second');
    state.user = null;
    rerender(<ApplicationProviders><Probe /></ApplicationProviders>);
    expect(screen.queryByText('second')).toBeNull();
    await screen.findByText('guest');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('refreshes question lists after writes without replacing active session pages', async () => {
    const list = vi.fn(async () => 'questions');
    const session = vi.fn(async () => 'active session');
    function Probe() {
      const query = useSWR('/backend-api/api/questions?topic=test', list);
      const attempt = useSWR('/backend-api/api/questions/session?topic=test', session);
      return <span>{query.data} {attempt.data}</span>;
    }
    render(<ApplicationProviders><Probe /></ApplicationProviders>);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await act(async () => { await invalidateQuestionQueries(); });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(session).toHaveBeenCalledTimes(1);
  });
});
