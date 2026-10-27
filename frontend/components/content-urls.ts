// Keep web URLs and local asset paths intact when parsing slash fractions.
const URL_SOURCE = String.raw`(?:https?://|/(?:backend-api/)?api/upload/image/|/(?:pyq-assets|images)/)[^\s<>"')]+`;

// A slash alone is not math: it is common in bilingual prose, alternatives,
// paths, and dates. Match only complete, standalone numeric fractions.
export const STANDALONE_NUMERIC_FRAC_SOURCE = String.raw`(?<!\/\s*)(?<![/\-\p{L}\p{M}\p{N}_])(\([+-]?\d+(?:\.\d+)?\)|[+-]?\d+(?:\.\d+)?)\s*\/\s*(\([+-]?\d+(?:\.\d+)?\)|[+-]?\d+(?:\.\d+)?)(?:%)?(?!\s*\/)(?![/\-\p{L}\p{M}\p{N}_])`;

export function createStandaloneNumericFracRegex(): RegExp {
  return new RegExp(STANDALONE_NUMERIC_FRAC_SOURCE, 'gu');
}

export function splitContentUrls(text: string): Array<{ isUrl: boolean; text: string }> {
  const segments: Array<{ isUrl: boolean; text: string }> = [];
  let cursor = 0;
  for (const match of text.matchAll(new RegExp(URL_SOURCE, 'gi'))) {
    if (match.index > cursor) segments.push({ isUrl: false, text: text.slice(cursor, match.index) });
    segments.push({ isUrl: true, text: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ isUrl: false, text: text.slice(cursor) });
  return segments;
}

export function hasSlashOutsideUrls(text: string): boolean {
  return text.includes('/') && createStandaloneNumericFracRegex().test(stripContentUrls(text));
}

export function stripContentUrls(text: string): string {
  return text.replace(new RegExp(URL_SOURCE, 'gi'), '');
}
