import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const destination = new URL('../public/images/topic-thumbnails/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('sources.json', destination), 'utf8'));
const base = `https://raw.githubusercontent.com/microsoft/fluentui-emoji/${manifest.commit}/`;

async function download(path) {
  const response = await fetch(`${base}${path.split('/').map(encodeURIComponent).join('/')}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Limit concurrent image processing and keep transparent edges for both themes.
const pending = Object.entries(manifest.images);
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let asset = pending.pop(); asset; asset = pending.pop()) {
    const [name, path] = asset;
    const image = await sharp(await download(path)).resize(128, 128, { fit: 'contain', background: '#00000000' }).webp({ quality: 85 }).toBuffer();
    await writeFile(new URL(`${name}.webp`, destination), image);
  }
}));
await writeFile(new URL('LICENSE.txt', destination), await download('LICENSE'));
console.log(`Saved ${Object.keys(manifest.images).length} local topic thumbnails.`);
