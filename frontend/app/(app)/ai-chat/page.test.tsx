import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType, ReactNode } from 'react';
import AiChatPage from './page';

const probes = vi.hoisted(() => ({ markdown: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ default: probes }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'chat-performance' } }) }));
vi.mock('@/hooks/useTheme', () => ({ useThemeMode: () => ({ theme: 'light' }) }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/hooks/useAppNavigation', () => ({ useBackLayer: vi.fn() }));
vi.mock('@/components/BackButton', () => ({ default: () => <button type="button">Back</button> }));
vi.mock('@/components/RiskyWidgetBoundary', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => {
  probes.markdown(children);
  return <div>{children}</div>;
} }));
vi.mock('next/dynamic', async () => {
  const { lazy, Suspense, createElement } = await import('react');
  return { default: (load: () => Promise<{ default: ComponentType<object> }>) => {
    const Component = lazy(load);
    return (props: object) => createElement(Suspense, { fallback: null }, createElement(Component, props));
  } };
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  probes.get.mockResolvedValue({ data: { aiChats: [{ id: 'saved', title: 'Saved math', messages:
    Array.from({ length: 10 }, (_, i) => [
      { role: 'user', content: `Question ${i}` },
      { role: 'bot', content: `Existing reply ${i}: $x=${i}$` },
    ]).flat(),
  }] } });
  probes.post.mockResolvedValue({ data: { success: true, reply: 'Validated reply' } });
  probes.put.mockResolvedValue({ data: {} });
  probes.delete.mockResolvedValue({ data: {} });
});

describe('AI chat draft isolation', () => {
  it('does not reparse existing responses while typing, and clears the draft for a new chat', async () => {
    render(<AiChatPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Saved math' }));
    // Suspense can render replies before committing them, then replay that work.
    // Measure draft updates only after all lazy-rendered replies are in the DOM.
    await waitFor(() => expect(screen.getAllByText(/^Existing reply \d+:/)).toHaveLength(10), { timeout: 10_000 });
    probes.markdown.mockClear();
    const input = screen.getByRole('textbox', { name: 'Ask ChatGPT' });
    for (const text of ['e', 'ex', 'exp', 'expl', 'explain']) {
      fireEvent.change(input, { target: { value: text } });
      expect(probes.markdown).not.toHaveBeenCalled();
    }
    expect(input).toHaveValue('explain');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(probes.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(input).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('sends the child draft and still validates the response after loading the schemas', async () => {
    render(<AiChatPage />);
    const input = screen.getByRole('textbox', { name: 'Ask ChatGPT' });
    fireEvent.change(input, { target: { value: 'Explain percentages' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Validated reply');
    expect(probes.post).toHaveBeenCalledWith('/api/ai/tutor-chat', expect.objectContaining({ message: 'Explain percentages' }), expect.anything());
    expect(input).toHaveValue('');
    probes.post.mockResolvedValueOnce({ data: { success: false, reply: 'Invalid reply must not render' } });
    fireEvent.change(input, { target: { value: 'Next question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(document.body.textContent).toContain('expected true'));
    expect(screen.queryByText('Invalid reply must not render')).toBeNull();
  });
});
