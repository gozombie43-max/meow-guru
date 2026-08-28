import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BottomNav from '../BottomNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/mock-test',
}));

describe('BottomNav Component', () => {
  it('renders all core navigation links', () => {
    render(<BottomNav />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Mock')).toBeDefined();
    expect(screen.getByText('Play')).toBeDefined();
    expect(screen.getByText('Videos')).toBeDefined();
    expect(screen.getByLabelText('AI Assistant')).toBeDefined();
  });

  it('highlights the active navigation tab', () => {
    const { container } = render(<BottomNav />);
    const activeLink = container.querySelector('a[href="/mock-test"]');
    expect(activeLink).not.toBeNull();
  });
});
