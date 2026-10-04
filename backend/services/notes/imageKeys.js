// @ts-check
const safeKey = /^notes\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:webp|png|jpe?g|gif)$/;

/** @param {unknown} value @returns {value is string} */
export const isNoteImageKey = value => typeof value === 'string' && safeKey.test(value) && !value.split('/').includes('..');

/** Derive references from the saved HTML, never a client-supplied imageKeys array.
 * @param {unknown} body
 * @returns {string[]}
 */
export function noteImageKeys(body) {
  if (typeof body !== 'string') return [];
  const keys = new Set();
  for (const match of body.matchAll(/\/api\/upload\/image\/([A-Za-z0-9_-]+)/g)) {
    const key = Buffer.from(match[1], 'base64url').toString('utf8');
    if (isNoteImageKey(key)) keys.add(key);
  }
  return [...keys];
}
