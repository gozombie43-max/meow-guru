import { apiUrl } from '@/lib/api-base';

export function noteImageUrl(url: string) {
  return url.startsWith('/api/upload/image/') ? apiUrl(url) : url;
}

export function resolveNoteImageSources(body: string) {
  return body.replace(/(\bsrc\s*=\s*["'])(\/api\/upload\/image\/[A-Za-z0-9_-]+)(["'])/gi, (_match, prefix: string, url: string, suffix: string) => `${prefix}${noteImageUrl(url)}${suffix}`);
}

export function escapeNoteAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
