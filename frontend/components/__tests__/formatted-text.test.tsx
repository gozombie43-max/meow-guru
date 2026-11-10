import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { formatMarkdownBold, renderFormattedProse, hasMarkdownBold, renderPartsWithBold, RenderablePart } from '../formatted-text';

describe('formatted-text utilities', () => {
  it('detects markdown bold with asterisks and underscores', () => {
    expect(hasMarkdownBold('This is **bold** text')).toBe(true);
    expect(hasMarkdownBold('This is __bold__ text')).toBe(true);
    expect(hasMarkdownBold('No bold text here')).toBe(false);
    expect(hasMarkdownBold('Single *asterisk* and _underscore_')).toBe(false);
    expect(hasMarkdownBold('Empty **** and ____')).toBe(false);
    expect(hasMarkdownBold('Spaced ** not bold ** and __ not bold __')).toBe(false);
  });

  it('formats markdown bold nodes directly with formatMarkdownBold', () => {
    const nodes = formatMarkdownBold('**bold** text');
    const { container } = render(<>{nodes}</>);
    expect(container.textContent).toBe('bold text');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders double asterisk bold as strong tag', () => {
    const { container } = render(<>{renderFormattedProse('Calculate the **area** of the triangle.')}</>);
    expect(container.textContent).toBe('Calculate the area of the triangle.');
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('area');
    expect(strong?.className).toContain('font-bold');
  });

  it('renders double underscore bold as strong tag', () => {
    const { container } = render(<>{renderFormattedProse('Step 1: __Divide by 2__ then continue.')}</>);
    expect(container.textContent).toBe('Step 1: Divide by 2 then continue.');
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('Divide by 2');
    expect(strong?.className).toContain('font-bold');
  });

  it('handles multiple bold occurrences in one string', () => {
    const { container } = render(<>{renderFormattedProse('**First:** do this. __Second:__ do that.')}</>);
    expect(container.textContent).toBe('First: do this. Second: do that.');
    const strongs = container.querySelectorAll('strong');
    expect(strongs).toHaveLength(2);
    expect(strongs[0].textContent).toBe('First:');
    expect(strongs[1].textContent).toBe('Second:');
  });

  it('preserves URLs without bolding underscores or asterisks in filenames', () => {
    const url = 'https://example.com/asset__1__v2.png';
    const { container } = render(<>{renderFormattedProse(`Check ${url} and see **important** details.`)}</>);
    expect(container.textContent).toContain(url);
    const strongs = container.querySelectorAll('strong');
    expect(strongs).toHaveLength(1);
    expect(strongs[0].textContent).toBe('important');
  });

  it('allows single asterisks and single underscores inside bold text', () => {
    const { container } = render(<>{renderFormattedProse('**Formula: a * b** and __snake_case_name__')}</>);
    const strongs = container.querySelectorAll('strong');
    expect(strongs).toHaveLength(2);
    expect(strongs[0].textContent).toBe('Formula: a * b');
    expect(strongs[1].textContent).toBe('snake_case_name');
  });

  it('does not bold single asterisks, dates, or ordinary slashes', () => {
    const { container } = render(<>{renderFormattedProse('Ratio 3:4, date 15/08/1947, calc 3 * 4 = 12')}</>);
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toBe('Ratio 3:4, date 15/08/1947, calc 3 * 4 = 12');
  });

  it('renders cross-part bolding wrapping math parts', () => {
    const parts: RenderablePart[] = [
      { type: 'text', content: '**' },
      { type: 'inline', content: 'x = 2' },
      { type: 'text', content: '**' },
    ];
    const { container } = render(
      <>
        {renderPartsWithBold(
          parts,
          (p, i) => <span key={i} className="math">{p.content}</span>,
          (text, k) => <span key={k}>{text}</span>
        )}
      </>
    );
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.querySelector('.math')?.textContent).toBe('x = 2');
  });

  it('renders cross-part bold with text prefix and math and text suffix', () => {
    const parts: RenderablePart[] = [
      { type: 'text', content: 'Start: **Calculate ' },
      { type: 'inline', content: 'x^2' },
      { type: 'text', content: ' carefully.** Done.' },
    ];
    const { container } = render(
      <>
        {renderPartsWithBold(
          parts,
          (p, i) => <span key={i} className="math">{p.content}</span>,
          (text, k) => <span key={k}>{text}</span>
        )}
      </>
    );
    expect(container.textContent).toBe('Start: Calculate x^2 carefully. Done.');
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('Calculate x^2 carefully.');
  });
});
