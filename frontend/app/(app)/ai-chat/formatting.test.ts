import { describe, expect, it } from 'vitest';

import { createChatId, getChatTitle, normalizeTutorMarkdown } from './formatting';

describe('AI chat formatting', () => {
  it('creates a readable title from markdown input', () => {
    expect(getChatTitle('**Percentages** and _ratios_')).toBe('Percentages and ratios');
    expect(getChatTitle('   ')).toBe('New chat');
  });

  it('normalizes common LaTeX delimiters', () => {
    expect(normalizeTutorMarkdown('Use \\(\\frac{1}{2}\\).')).toBe('Use $\\frac{1}{2}$.');
    expect(normalizeTutorMarkdown('\\[x = 4\\]')).toBe('$$x = 4$$');
  });

  it('creates a non-empty chat identifier', () => {
    expect(createChatId()).toEqual(expect.any(String));
    expect(createChatId()).not.toHaveLength(0);
  });
});
