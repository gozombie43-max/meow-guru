import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JamMockCatalog from './JamMockCatalog';

const auth = vi.hoisted(() => ({ user: null as { role?: string } | null, loading: false }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./ExamHomeContent', () => ({ JamSectionCards: () => <div>Section cards</div> }));

beforeEach(() => { auth.user = null; auth.loading = false; });

describe('custom test access', () => {
  it.each(['admin', 'superadmin'])('offers the protected editor to %s', role => {
    auth.user = { role };
    render(<JamMockCatalog />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByRole('link', { name: 'Create custom test' })).toHaveAttribute('href', '/admin/upload/mock-tests');
    expect(screen.queryByRole('link', { name: 'Create practice session' })).not.toBeInTheDocument();
  });

  it.each([undefined, 'user', 'student', 'moderator', 'unknown'])('does not offer creation to %s', role => {
    auth.user = role ? { role } : null;
    render(<JamMockCatalog />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse mock tests' })).toHaveAttribute('href', '/mock-test/iit-jam-physics');
  });

  it('waits for auth and removes creation when access changes', () => {
    auth.user = { role: 'admin' };
    auth.loading = true;
    const { rerender } = render(<JamMockCatalog />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
    auth.loading = false;
    rerender(<JamMockCatalog />);
    expect(screen.getByRole('link', { name: 'Create custom test' })).toBeInTheDocument();
    auth.user = { role: 'user' };
    rerender(<JamMockCatalog />);
    expect(screen.queryByRole('link', { name: /Create/ })).not.toBeInTheDocument();
  });
});
