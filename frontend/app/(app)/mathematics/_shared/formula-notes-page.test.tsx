import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import FormulaNotesPage from './formula-notes-page';
const requests = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/api/http', () => ({ fetchWithRetry: requests.fetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }), useParams: () => ({}) }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });
it('loads only the active category and shares an intent request with a tab switch without stale results', async () => {
  let notes!: (response: unknown) => void;
  let formula!: (response: unknown) => void;
  requests.fetch.mockImplementation((url: string) => new Promise(resolve => {
    if (url.includes('category=notes')) notes = resolve; else formula = resolve;
  }));
  render(<FormulaNotesPage topic="dedupe-test" />);
  await waitFor(() => expect(requests.fetch).toHaveBeenCalledTimes(1));
  const tab = screen.getByRole('tab', { name: 'FORMULA' });
  fireEvent.pointerEnter(tab);
  fireEvent.click(tab);
  await waitFor(() => expect(requests.fetch).toHaveBeenCalledTimes(2));
  const response = (title: string) => ({ ok: true, json: async () => ({ pdfs: [{ id: title, title, topic: 'dedupe-test', streamUrl: '/pdf' }] }) });
  await act(async () => { formula(response('Formula file')); });
  expect(await screen.findByText('Formula file')).toBeVisible();
  await act(async () => { notes(response('Stale notes')); });
  expect(screen.queryByText('Stale notes')).toBeNull();
  expect(screen.getByText('Formula file')).toBeVisible();
});
