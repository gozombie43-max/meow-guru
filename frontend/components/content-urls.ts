// Keep web URLs and local asset paths intact when parsing slash fractions.
const URL_SOURCE = String.raw`(?:https?://|/(?:backend-api/)?api/upload/image/|/(?:pyq-assets|images)/)[^\s<>"')]+`;

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
  return text.includes('/') && stripContentUrls(text).includes('/');
}

export function stripContentUrls(text: string): string {
  return text.replace(new RegExp(URL_SOURCE, 'gi'), '');
}
