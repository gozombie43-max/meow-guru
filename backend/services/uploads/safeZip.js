import JSZip from 'jszip';

export const ZIP_LIMITS = Object.freeze({ compressedBytes: 20 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, entryBytes: 8 * 1024 * 1024, entries: 1000 });
export const IMAGE_INPUT_OPTIONS = Object.freeze({ limitInputPixels: 16_000_000, failOn: 'warning' });
const rejected = message => Object.assign(new Error(message), { statusCode: 413 });

// Bound the actual inflated stream, not just the ZIP's attacker-controlled metadata.
async function readEntry(entry, budget, limits) {
  const chunks = [];
  let bytes = 0;
  const stream = entry.nodeStream('nodebuffer');
  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('data', chunk => {
      bytes += chunk.length;
      budget.bytes += chunk.length;
      if (bytes > limits.entryBytes || budget.bytes > limits.totalBytes) {
        stream.pause();
        stream.destroy();
        reject(rejected('ZIP expanded size exceeds the import limit'));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks, bytes)));
  });
}

export async function loadSafeZip(buffer, limits = ZIP_LIMITS) {
  if (buffer.length > limits.compressedBytes) throw rejected('ZIP compressed size exceeds the import limit');
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > limits.entries) throw rejected('ZIP contains too many entries');
  const budget = { bytes: 0 };
  // Complete validation before callers can upload images or mutate questions.
  for (const entry of entries) {
    if (entry.dir) continue;
    const rawName = entry.unsafeOriginalName || entry.name;
    if (rawName.includes('..') || rawName.startsWith('/') || rawName.includes('\\')) throw rejected('Unsafe ZIP entry path');
    const data = await readEntry(entry, budget, limits);
    entry.async = async type => {
      if (type === 'string' || type === 'text') return data.toString('utf8');
      if (type === 'nodebuffer') return data;
      throw new Error('Unsupported ZIP output type');
    };
  }
  return zip;
}
