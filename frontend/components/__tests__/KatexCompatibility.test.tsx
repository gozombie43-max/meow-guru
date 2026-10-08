import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { BlockMath, InlineMath } from 'react-katex';
import TutorMarkdown from '@/components/QuizChatbot/TutorMarkdown';

describe('patched KaTeX consumers', () => {
  it('renders inline and display math through the admin preview wrapper', () => {
    const { container } = render(<><InlineMath math="\\frac{1}{2}" /><BlockMath math="x^2 + y^2" /></>);
    expect(container.querySelectorAll('.katex')).toHaveLength(2);
    expect(container.querySelector('.katex-display')).not.toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
  });

  it('renders tutor Markdown math through remark-math and rehype-katex', () => {
    const { container } = render(<TutorMarkdown content={'Inline $\\frac{1}{2}$\n\n$$\n\\sqrt{4}\n$$'} />);
    expect(container.querySelectorAll('.katex')).toHaveLength(2);
    expect(container.querySelector('.katex-display')).not.toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
  });

  it('does not inherit trusted rendering from the options prototype', () => {
    const inherited = Object.create({ trust: true });
    const html = katex.renderToString('\\href{javascript:alert(1)}{link}', inherited);
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<a ');
  });
});
