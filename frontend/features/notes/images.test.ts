import { expect, it } from 'vitest';
import { noteImageUrl, resolveNoteImageSources, escapeNoteAttribute } from './images';
it('resolves legacy note image URLs through the API proxy and preserves stored/external URLs', () => {
  expect(noteImageUrl('/api/upload/image/abc')).toBe('/backend-api/api/upload/image/abc');
  expect(noteImageUrl('https://api.example.test/api/upload/image/abc')).toBe('https://api.example.test/api/upload/image/abc');
  expect(resolveNoteImageSources('<img src="/api/upload/image/abc"><img src=\'/api/upload/image/def\'>')).toBe('<img src="/backend-api/api/upload/image/abc"><img src=\'/backend-api/api/upload/image/def\'>');
  expect(resolveNoteImageSources('<img src="/backend-api/api/upload/image/abc">')).toBe('<img src="/backend-api/api/upload/image/abc">');
  expect(escapeNoteAttribute('a" <&>')).toBe('a&quot; &lt;&amp;&gt;');
});
