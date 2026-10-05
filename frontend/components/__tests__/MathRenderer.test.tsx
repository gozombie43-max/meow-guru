import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MathRenderer from '../MathRenderer';
import MathRendererContent from '../MathRendererContent';
import TutorMarkdown from '../QuizChatbot/TutorMarkdown';

describe('MathRenderer Component', () => {
  it('keeps fractions, matrices and untrusted commands consistent across both math paths', () => {
    const formula = String.raw`\frac{1}{2}+\sqrt{x}+\begin{pmatrix}1&2\\3&4\end{pmatrix}`;
    const { container } = render(<><MathRendererContent text={`$${formula}$`} /><TutorMarkdown content={`$${formula}$`} /></>);
    expect(container.querySelectorAll('.katex')).toHaveLength(2);
    expect(container.querySelector('.katex-error')).toBeNull();
    const unsafe = render(<><MathRendererContent text={String.raw`$\href{javascript:alert(1)}{click}$`} /><TutorMarkdown content={String.raw`$\href{javascript:alert(1)}{click}$`} /></>);
    expect(unsafe.container.querySelector('a')).toBeNull();
  });
  it('keeps imported prose numerals sans serif without changing equations', () => {
    const { container } = render(<MathRendererContent text={String.raw`Increase by $15\%$ to $19,320$. Solve $x + 2 = 5$.`} />);
    expect(container.textContent).toContain('Increase by 15% to 19,320.');
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
  });
  it('preserves standalone numbers explicitly marked as math', () => {
    const { container } = render(<MathRendererContent text="$19,320$" />);
    expect(container.querySelector('.katex')).not.toBeNull();
  });
  it('renders null when text is empty', async () => {
    const { container } = render(<MathRenderer text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders plain text correctly', async () => {
    render(<MathRenderer text="Find the area of the rectangle" />);
    expect(screen.getByText(/Find the area of the rectangle/i)).toBeDefined();
  });

  it('renders inline math expressions correctly', async () => {
    const { container } = render(<MathRenderer text="Calculate $x + y = 10$" />);
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('renders bracketed display math expressions', async () => {
    const { container } = render(<MathRenderer text="Formula: \\[E = mc^2\\]" />);
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('renders parenthesized option math containing a LaTeX fraction', async () => {
    const { container } = render(
      <MathRenderer text="\\(a=3, b=-\\frac{3}{2}\\)" inline />
    );

    await waitFor(() => expect(container.querySelector('.katex-html')).not.toBeNull());
    const visibleMath = container.querySelector('.katex-html');
    expect(visibleMath).not.toBeNull();
    expect(visibleMath?.textContent).not.toContain('\\frac');
  });

  it('renders fractions with fraction regex parsing', async () => {
    const { container } = render(<MathRenderer text="Probability is 3/4" />);
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
    const katexEl = container.querySelector('.katex');
    expect(katexEl).not.toBeNull();
  });

  it('handles percentage in fraction denominators', async () => {
    render(<MathRenderer text="Growth rate is 1/5%" />);
    expect(await screen.findByText('%')).toBeDefined();
  });
});
