import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MathText from '../MathText';

describe('MathText Component', () => {
  it.each(['12^{-23}', '3^{24}', '12^{-11}', '4^{24}'])('renders bare option power %s', async (text) => {
    const { container } = render(<MathText text={text} />);
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
    expect(container.querySelector('msup')).not.toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
  });

  it.each(['12^{-2/3}', String.raw`12^{-\frac{2}{3}}`, String.raw`\frac{3}{4}`, String.raw`$12^{-2/3}$`])('keeps fraction expression %s intact', async (text) => {
    const { container } = render(<MathText text={text} />);
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(1));
    expect(container.querySelector('mfrac')).not.toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
  });

  it('renders an empty span when text is empty', async () => {
    const { container } = render(<MathText text="" className="custom-class" />);
    const span = container.querySelector('span.custom-class');
    expect(span).not.toBeNull();
  });

  it('renders text with fraction layout elements', async () => {
    const { container } = render(<MathText text="Value is 7/8 in lowest terms" />);
    const mathRole = container.querySelector('[role="math"]');
    expect(mathRole).not.toBeNull();
  });

  it('renders fraction with percentage sign', async () => {
    render(<MathText text="Rate is 1/2%" />);
    expect(await screen.findByText('%')).toBeDefined();
  });
});
