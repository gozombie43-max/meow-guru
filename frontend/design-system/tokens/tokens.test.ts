import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TOKENS_DIR = join(process.cwd(), 'design-system', 'tokens');
const GLOBALS_CSS = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
const THEME_CSS = readFileSync(join(TOKENS_DIR, 'theme.css'), 'utf8');
const MOTION_CSS = readFileSync(join(TOKENS_DIR, 'motion.css'), 'utf8');

function extractRuleBody(css: string, headerPattern: RegExp): string {
  const match = headerPattern.exec(css);
  expect(match, `Missing block matching ${headerPattern}`).not.toBeNull();
  const start = css.indexOf('{', match!.index);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  throw new Error(`Unclosed block for ${headerPattern}`);
}

function parseCustomProps(block: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    props[match[1]] = match[2].trim();
  }
  return props;
}

function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const int = Number.parseInt(full, 16);
  const rgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  return rgb
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, ch, idx) => sum + ch * [0.2126, 0.7152, 0.0722][idx], 0);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const fg = hexLuminance(fgHex);
  const bg = hexLuminance(bgHex);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

describe('Meow Design System Tokens (PR P0-A)', () => {
  it('wires theme and motion tokens cleanly into globals.css after tailwindcss', () => {
    const lines = GLOBALS_CSS.split(/\r?\n/).slice(0, 5).join('\n');
    expect(lines).toContain('@import "tailwindcss";');
    expect(lines).toContain('@import "../design-system/tokens/theme.css";');
    expect(lines).toContain('@import "../design-system/tokens/motion.css";');
  });

  it('exposes Tailwind v4 @theme inline utilities for all canonical semantic roles', () => {
    const themeInline = extractRuleBody(THEME_CSS, /@theme\s+inline\s*\{/);
    const inlineProps = parseCustomProps(themeInline);

    const requiredTailwindVars = [
      '--color-meow-bg',
      '--color-meow-surface',
      '--color-meow-surface-subtle',
      '--color-meow-border',
      '--color-meow-text',
      '--color-meow-secondary',
      '--color-meow-muted',
      '--color-meow-accent',
      '--color-meow-accent-light',
      '--color-meow-action-fill',
      '--color-meow-on-accent',
      '--color-meow-success',
      '--color-meow-warning',
      '--color-meow-error',
      '--color-meow-info',
      '--font-meow-sans',
      '--font-meow-mono',
      '--radius-meow-md',
      '--radius-meow-lg',
    ];

    for (const token of requiredTailwindVars) {
      expect(inlineProps[token], `Missing @theme inline token ${token}`).toBeDefined();
    }
  });

  it('defines canonical Meow dark palette and accessible light palette with matching semantic names', () => {
    const rootVars = parseCustomProps(extractRuleBody(THEME_CSS, /:root\s*\{/));
    const darkVars = parseCustomProps(
      extractRuleBody(THEME_CSS, /html\.theme-dark,\s*body\.theme-dark,\s*\.theme-dark,\s*\[data-theme="dark"\],\s*\.training-dark\s*\{/),
    );
    const lightVars = parseCustomProps(
      extractRuleBody(THEME_CSS, /html\.theme-light,\s*body\.theme-light,\s*\.theme-light,\s*\[data-theme="light"\]\s*\{/),
    );

    expect(rootVars['--meow-bg'].toUpperCase()).toBe('#000000');
    expect(rootVars['--meow-surface'].toUpperCase()).toBe('#111722');
    expect(rootVars['--meow-border'].toUpperCase()).toBe('#222A38');
    expect(rootVars['--meow-text'].toUpperCase()).toBe('#F1F4F8');
    expect(rootVars['--meow-secondary'].toUpperCase()).toBe('#929CAF');
    expect(rootVars['--meow-muted'].toUpperCase()).toBe('#687386');
    expect(rootVars['--meow-accent'].toUpperCase()).toBe('#3B82F6');
    expect(rootVars['--meow-accent-light'].toUpperCase()).toBe('#60A5FA');
    expect(rootVars['--meow-action-fill'].toUpperCase()).toBe('#2563EB');

    for (const semanticKey of [
      '--meow-bg',
      '--meow-surface',
      '--meow-surface-subtle',
      '--meow-border',
      '--meow-text',
      '--meow-secondary',
      '--meow-muted',
      '--meow-accent',
      '--meow-accent-light',
      '--meow-action-fill',
      '--meow-on-accent',
      '--meow-success',
      '--meow-success-soft',
      '--meow-warning',
      '--meow-warning-soft',
      '--meow-error',
      '--meow-error-soft',
      '--meow-info',
      '--meow-info-soft',
    ]) {
      expect(darkVars[semanticKey], `Dark block missing ${semanticKey}`).toBeDefined();
      expect(lightVars[semanticKey], `Light block missing ${semanticKey}`).toBeDefined();
    }
  });

  it('meets WCAG AA (>= 4.5:1) contrast for all readable text, primary CTA fills, and semantic feedback pairs', () => {
    const darkVars = parseCustomProps(extractRuleBody(THEME_CSS, /:root\s*\{/));
    const lightVars = parseCustomProps(
      extractRuleBody(THEME_CSS, /html\.theme-light,\s*body\.theme-light,\s*\.theme-light,\s*\[data-theme="light"\]\s*\{/),
    );

    for (const [mode, palette, readableKeys] of [
      ['dark', darkVars, ['--meow-text', '--meow-secondary', '--meow-accent-light']],
      ['light', lightVars, ['--meow-text', '--meow-secondary', '--meow-muted', '--meow-accent', '--meow-accent-light']],
    ] as const) {
      for (const fg of readableKeys) {
        for (const bg of ['--meow-bg', '--meow-surface', '--meow-surface-subtle'] as const) {
          const ratio = contrastRatio(palette[fg], palette[bg]);
          expect(ratio, `${mode} contrast ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }

      expect(
        contrastRatio(palette['--meow-on-accent'], palette['--meow-action-fill']),
        `${mode} primary CTA contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(palette['--meow-on-accent'], palette['--meow-action-fill-hover']),
        `${mode} primary CTA hover contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(palette['--meow-on-accent'], palette['--meow-danger-fill']),
        `${mode} danger CTA contrast`,
      ).toBeGreaterThanOrEqual(4.5);

      for (const state of ['success', 'warning', 'error', 'info'] as const) {
        expect(
          contrastRatio(palette[`--meow-${state}`], palette[`--meow-${state}-soft`]),
          `${mode} ${state} soft badge contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }

    // Verify why #687386 is strictly disallowed for readable copy in dark mode
    expect(contrastRatio('#687386', '#111722')).toBeLessThan(4.5);
  });

  it('maps shared variable namespaces inside [data-meow-tokens] in theme.css', () => {
    const scopedBridge = parseCustomProps(extractRuleBody(THEME_CSS, /\[data-meow-tokens\]\s*\{/));

    const requiredScopedMappings = [
      '--oled-canvas',
      '--oled-surface',
      '--dark-canvas',
      '--dark-surface',
      '--dark-accent',
      '--dark-action',
      '--dark-text-muted',
      '--light-canvas',
      '--light-surface',
      '--ui-surface',
      '--ui-action',
      '--ui-text',
      '--mac-window-bg',
      '--admin-bg',
      '--tr-surface',
      '--tfp-surface',
      '--quiz-surface',
    ];
    for (const key of requiredScopedMappings) {
      expect(scopedBridge[key], `Missing [data-meow-tokens] mapping for ${key}`).toBeDefined();
    }
    expect(scopedBridge['--dark-text-muted']).toBe('var(--meow-secondary)');
    expect(scopedBridge['--text-muted']).toBe('var(--meow-secondary)');
    expect(scopedBridge['--dark-action']).toBe('var(--meow-action-fill)');
    expect(scopedBridge['--ui-action']).toBe('var(--meow-action-fill)');
  });

  it('defines motion tokens, shared keyframes, and prefers-reduced-motion support without unsafe rules', () => {
    expect(MOTION_CSS).toContain('--meow-duration-fast');
    expect(MOTION_CSS).toContain('--meow-duration-base');
    expect(MOTION_CSS).toContain('--meow-duration-slow');
    expect(MOTION_CSS).toContain('--meow-ease-standard');
    expect(MOTION_CSS).toContain('@keyframes meow-spin');
    expect(MOTION_CSS).toContain('@keyframes meow-fade-in');
    expect(MOTION_CSS).toContain('@keyframes meow-shake');
    expect(MOTION_CSS).toContain('@media (prefers-reduced-motion: reduce)');

    for (const css of [THEME_CSS, MOTION_CSS]) {
      expect(css).not.toMatch(/\btransition(?:-property)?\s*:\s*all\b/i);
      expect(css).not.toMatch(/\b100vh\b/i);
    }
  });
});
