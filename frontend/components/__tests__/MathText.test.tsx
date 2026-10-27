import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MathText from '../MathText';

describe('MathText Component', () => {
  it('preserves URL slashes alongside a real fraction', async () => {
    const { container } = render(<MathText text="Use https://example.com/a/b.png and /api/upload/image/key with 1/2" />);
    expect(container.textContent).toContain('https://example.com/a/b.png');
    expect(container.textContent).toContain('/api/upload/image/key');
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(1));
  });
  it('keeps URL filenames with underscores out of the math parser', () => {
    const text = 'https://example.com/x_1/figure.png';
    const { container } = render(<MathText text={text} />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector('[role="math"], .katex')).toBeNull();
  });
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

  it('uses the same inline KaTeX fraction layout as MathRenderer', async () => {
    const { container } = render(<MathText text="Value is 7/8 in lowest terms" />);
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
    expect(container.querySelector('mfrac')).not.toBeNull();
    expect(container.querySelector('[role="math"]')).toBeNull();
  });

  it('renders fraction with percentage sign', async () => {
    const { container } = render(<MathText text="Rate is 1/2%" />);
    expect(await screen.findByText('%')).toBeDefined();
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
  });

  it.each(['3/4', '-1/2', '(1)/(2)', '1/5%'])('keeps genuine standalone fraction layout for %s', async (text) => {
    const { container } = render(<MathText text={text} />);
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
  });

  it('keeps sentence fractions inline without the legacy stacked DOM', async () => {
    const text = 'ভুট্টা, শসা, ডুমুর এবং তরমুজ/খরমুজ — Probability is 3/4 and date is 15/08/1947';
    const { container } = render(<MathText text={text} />);
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(1));
    expect(container.textContent).toContain('ভুট্টা, শসা, ডুমুর এবং তরমুজ/খরমুজ — Probability is ');
    expect(container.textContent).toContain(' and date is 15/08/1947');
    expect(container.querySelector('[role="math"]')).toBeNull();
  });

  it.each([
    'রাজ্য / নগরগুলির',
    'ভুট্টা, শসা, ডুমুর এবং তরমুজ/খরমুজ',
    'পতঙ্গ/আর্থ্রোপোড',
    'and/or',
    'state / city',
    'true / false',
    'is/are',
    '15/08/1947',
    '25/10/2026',
    '১৫/০৮/১৯৪৭',
    'Ratio is 3:4 or ৩:৪',
  ])('keeps ordinary prose slashes and dates inline: %s', (text) => {
    const { container } = render(<MathText text={text} />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector('[role="math"], .katex, mfrac')).toBeNull();
  });
});
