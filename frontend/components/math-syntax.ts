import { stripContentUrls } from './content-urls';

/** Cheap check for LaTeX/math delimiters — avoids KaTeX for pure text. */
const MATH_INDICATOR_RE = /\\(?:\[|\(|frac|sqrt|sum|int|cdot|times|div|pm|infty|alpha|beta|gamma|theta|pi|sigma|delta|epsilon|lambda|mu|omega|text\{)|\$[^$]/;
// Bare uploaded answers often omit math delimiters. Recognize explicit powers
// and fraction commands without treating ordinary words as equations.
const GROUP = String.raw`\{(?:[^{}]|\{[^{}]*\})*\}`;
export const BARE_MATH = String.raw`(?:\b\d+(?:\.\d+)?|\b[A-Za-z]|\([^()\n]+\))(?:\^|_)(?:${GROUP}|[+-]?\d+|[A-Za-z])|\\(?:dfrac|tfrac|frac)\s*${GROUP}\s*${GROUP}`;

export function containsMathSyntax(text: string): boolean {
  const content = stripContentUrls(text);
  return MATH_INDICATOR_RE.test(content) || new RegExp(BARE_MATH).test(content);
}

