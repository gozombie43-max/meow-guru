import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { loadSafeZip } from '../safeZip.js';

const limits = { compressedBytes: 10000, totalBytes: 100, entryBytes: 60, entries: 3 };
async function archive(files) {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) zip.file(name, contents);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
describe('bounded ZIP imports', () => {
  it('preserves metadata and image bytes', async () => {
    const zip = await loadSafeZip(await archive({ 'metadata.json': '[]', 'image.png': 'image' }), limits);
    expect(await zip.file('metadata.json').async('string')).toBe('[]');
    expect(await zip.file('image.png').async('nodebuffer')).toEqual(Buffer.from('image'));
  });
  it('rejects high-ratio expansion before exposing the archive', async () => {
    await expect(loadSafeZip(await archive({ bomb: 'x'.repeat(10000) }), limits)).rejects.toMatchObject({ statusCode: 413 });
  });
  it('bounds total bytes and entry counts', async () => {
    await expect(loadSafeZip(await archive({ a: 'x'.repeat(60), b: 'y'.repeat(60) }), limits)).rejects.toThrow('expanded size');
    await expect(loadSafeZip(await archive({ a: '', b: '', c: '', d: '' }), limits)).rejects.toThrow('too many');
  });
  it('rejects traversal paths', async () => {
    await expect(loadSafeZip(await archive({ '../bad': 'x' }), { ...limits, entries: 10 })).rejects.toThrow('Unsafe');
  });
});
