import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MathRenderer from '../MathRenderer';

describe('MathRenderer Component', () => {
  it('renders null when text is empty', () => {
    const { container } = render(<MathRenderer text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders plain text correctly', () => {
    render(<MathRenderer text="Find the area of the rectangle" />);
    expect(screen.getByText(/Find the area of the rectangle/i)).toBeDefined();
  });

  it('renders inline math expressions correctly', () => {
    const { container } = render(<MathRenderer text="Calculate $x + y = 10$" />);
    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('renders bracketed display math expressions', () => {
    const { container } = render(<MathRenderer text="Formula: \\[E = mc^2\\]" />);
    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('renders parenthesized option math containing a LaTeX fraction', () => {
    const { container } = render(
      <MathRenderer text="\\(a=3, b=-\\frac{3}{2}\\)" inline />
    );

    const visibleMath = container.querySelector('.katex-html');
    expect(visibleMath).not.toBeNull();
    expect(visibleMath?.textContent).not.toContain('\\frac');
  });

  it('renders fractions with fraction regex parsing', () => {
    const { container } = render(<MathRenderer text="Probability is 3/4" />);
    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('handles percentage in fraction denominators', () => {
    render(<MathRenderer text="Growth rate is 1/5%" />);
    expect(screen.getByText('%')).toBeDefined();
  });
});
