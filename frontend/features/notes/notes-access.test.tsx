import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import NotesPage from '@/app/(app)/notes/page';
import NoteWriteAccess from './NoteWriteAccess';

const { auth, replace, fetchWithRetry } = vi.hoisted(() => ({
  auth: { user: null as { role: string } | null, loading: false },
  replace: vi.fn(), fetchWithRetry: vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api/http', () => ({ fetchWithRetry }));
beforeEach(() => {
  vi.resetAllMocks(); auth.user = null; auth.loading = false;
  fetchWithRetry.mockResolvedValue(new Response(JSON.stringify([{ id: 'one', title: 'Revision', type: 'note', body: 'Body' }]), { status: 200 }));
});
afterEach(cleanup);
it.each([null, 'user', 'student', 'moderator', 'unknown'])('lets %s read notes while hiding every write control', async role => {
  auth.user = role ? { role } : null; render(<NotesPage />);
  expect(await screen.findByRole('link', { name: 'Revision' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /New note|Edit/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete Revision' })).not.toBeInTheDocument();
});
it.each(['admin', 'superadmin'])('shows note write controls for %s', async role => {
  auth.user = { role }; render(<NotesPage />);
  expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'New note' })).toHaveAttribute('href', '/notes/new');
  expect(screen.getByRole('button', { name: 'Delete Revision' })).toBeInTheDocument();
});
it('hides empty-library creation while signed out or restoring authentication', async () => {
  auth.loading = true; auth.user = { role: 'admin' };
  fetchWithRetry.mockResolvedValue(new Response('[]')); render(<NotesPage />);
  await screen.findByText('Make room for your next idea');
  expect(screen.queryByRole('link', { name: /Create|New note/ })).not.toBeInTheDocument();
});
it.each([null, 'user', 'student', 'moderator'])('guards direct write-page access for %s', async role => {
  auth.user = role ? { role } : null;
  render(<NoteWriteAccess><div>Private editor</div></NoteWriteAccess>);
  expect(screen.queryByText('Private editor')).not.toBeInTheDocument();
  await waitFor(() => expect(replace).toHaveBeenCalledWith(role ? '/notes' : '/login'));
});
it.each(['admin', 'superadmin'])('renders the protected editor for %s', role => {
  auth.user = { role }; render(<NoteWriteAccess><div>Private editor</div></NoteWriteAccess>);
  expect(screen.getByText('Private editor')).toBeInTheDocument(); expect(replace).not.toHaveBeenCalled();
});
it('waits for restored auth and removes the editor immediately after a role change', () => {
  auth.loading = true;
  const view = render(<NoteWriteAccess><div>Private editor</div></NoteWriteAccess>);
  expect(screen.getByRole('status')).toBeInTheDocument(); expect(replace).not.toHaveBeenCalled();
  auth.loading = false; auth.user = { role: 'admin' }; view.rerender(<NoteWriteAccess><div>Private editor</div></NoteWriteAccess>);
  expect(screen.getByText('Private editor')).toBeInTheDocument();
  auth.user = { role: 'user' }; view.rerender(<NoteWriteAccess><div>Private editor</div></NoteWriteAccess>);
  expect(screen.queryByText('Private editor')).not.toBeInTheDocument(); expect(replace).toHaveBeenCalledWith('/notes');
});
