import { expect, it } from 'vitest';
import { legacyImageFilenames, replaceLegacyImages } from '../legacyImageReferences.js';

it('preserves absolute URLs when the same filename also has a relative reference', () => {
  const input = '![local](/uploads/a.png) ![remote](https://old.example/uploads/a.png) <img src="//old.example/uploads/a.png">';
  expect(legacyImageFilenames(input)).toEqual(['a.png']);
  expect(replaceLegacyImages(input, new Map([['a.png', '/api/upload/image/new']]))).toBe(
    '![local](/api/upload/image/new) ![remote](https://old.example/uploads/a.png) <img src="//old.example/uploads/a.png">',
  );
});

it('replaces repeated verified files while preserving missing files', () => {
  const input = '/uploads/a.png /uploads/missing.png /uploads/a.png';
  expect(replaceLegacyImages(input, new Map([['a.png', '/api/upload/image/new']]))).toBe(
    '/api/upload/image/new /uploads/missing.png /api/upload/image/new',
  );
  expect(legacyImageFilenames('/uploads/next.png')).toEqual(['next.png']);
});
