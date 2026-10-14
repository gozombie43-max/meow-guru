import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Manual refresh only. Students browse local photos without third-party requests.
const destination = new URL('../public/images/topic-photos/', import.meta.url);
const overrides = JSON.parse(await readFile(new URL('./topic-photo-files.json', import.meta.url), 'utf8'));
const sources = JSON.parse(await readFile(new URL('./topic-photo-sources.json', import.meta.url), 'utf8'));
await mkdir(destination, { recursive: true });
const headers = { 'User-Agent': 'MeowGuruTopicPhotos/1.0 (educational subject thumbnails)' };
const cropFor = key => ['ashoka', 'gandhi', 'footprints', 'bose', 'sangam'].includes(key) ? 'north' : 'attention';
const sourceMatches = (photo, key, article) => photo?.article === article && (!overrides[key] || photo.original.replace(/_/g, ' ') === `File:${overrides[key]}`.replace(/_/g, ' '));
const reusable = (photo, key, article) => sourceMatches(photo, key, article) && photo.crop === cropFor(key);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, json = true) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(45000) });
    if (response.ok) return json ? response.json() : Buffer.from(await response.arrayBuffer());
    console.log(`Retry ${response.status}: ${url.slice(0, 90)}`);
    if (![429, 502, 503, 504].includes(response.status)) throw new Error(`${response.status}: ${url}`);
    await pause(2000 * (attempt + 1));
  }
  throw new Error(`Download failed: ${url}`);
}
const api = (host, params) => request(`https://${host}/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', ...params })}`);
const plain = value => (value || '').replace(/<[^>]*>/g, '').replace(/&(?:amp|quot|lt|gt);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>' })[entity]).trim();
const pages = {};
let previous = {};
try { previous = JSON.parse(await readFile(new URL('sources.json', destination), 'utf8')); } catch {}
const titles = [...new Set(Object.entries(sources).filter(([key, article]) => !sourceMatches(previous[key], key, article) && !overrides[key] && !Object.values(previous).some(photo => photo.article === article)).map(([, article]) => article))];
for (let offset = 0; offset < titles.length; offset += 35) {
  const result = await api('en.wikipedia.org', { titles: titles.slice(offset, offset + 35).join('|'), prop: 'pageimages|images', piprop: 'name', pilicense: 'free', imlimit: '20', redirects: '1' });
  for (const page of Object.values(result.query.pages)) pages[page.title] = page;
  for (const redirect of [...(result.query.normalized || []), ...(result.query.redirects || [])].reverse()) pages[redirect.from] = pages[redirect.to];
}
const candidatesFor = (article, key) => {
  if (overrides[key]) return [`File:${overrides[key]}`];
  const page = pages[article];
  const candidates = [...new Set([page?.pageimage && `File:${page.pageimage}`, ...(page?.images || []).map(image => image.title)].filter(Boolean))]
    .filter(title => /\.(jpe?g|png)$/i.test(title) && !/icon|logo|map|flag|symbol|question|disambig/i.test(title));
  return candidates.slice(0, 10);
};
// Some articles have a vector lead image. Read their photo gallery separately
// so the batched API's image continuation does not drop later articles.
for (const article of titles) {
  if (Object.values(previous).some(photo => photo.article === article)) continue;
  await pause(300);
  const result = await api('en.wikipedia.org', { titles: article, prop: 'pageimages|images', piprop: 'name', pilicense: 'free', imlimit: '50', redirects: '1' });
  pages[article] = Object.values(result.query.pages)[0];
}
const imageInfo = {};
const files = [...new Set(Object.entries(sources).filter(([key, article]) => !sourceMatches(previous[key], key, article)).flatMap(([key, article]) => candidatesFor(article, key)))];
for (let offset = 0; offset < files.length; offset += 15) {
  await pause(1500);
  const result = await api('commons.wikimedia.org', { titles: files.slice(offset, offset + 15).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '480' });
  for (const page of Object.values(result.query.pages)) imageInfo[page.title] = page.imageinfo?.[0];
  for (const normalized of result.query.normalized || []) imageInfo[normalized.from] = imageInfo[normalized.to];
}
const manifest = { ...previous };
const missing = [];
const used = new Map(Object.entries(previous).filter(([key, photo]) => reusable(photo, key, sources[key])).map(([key, photo]) => [photo.article, key]));
for (const [key, article] of Object.entries(sources)) {
  if (used.has(article)) { manifest[key] = manifest[used.get(article)]; continue; }
  if (reusable(previous[key], key, article)) { used.set(article, key); continue; }
  const candidates = candidatesFor(article, key);
  let selected = sourceMatches(previous[key], key, article) ? { ...previous[key], crop: cropFor(key) } : undefined;
  for (const title of selected ? [] : candidates) {
    const info = imageInfo[title];
    const meta = info?.extmetadata;
    const license = plain(meta?.LicenseShortName?.value);
    if (!info || !/^(CC BY|CC0|Public domain)/i.test(license) || /non.?commercial|fair use/i.test(license)) continue;
    selected = { crop: cropFor(key), file: `${key}.webp`, article, original: title, source: info.descriptionurl, download: info.thumburl || info.url, author: plain(meta.Artist?.value) || plain(meta.Credit?.value), license, licenseUrl: meta.LicenseUrl?.value || 'https://commons.wikimedia.org/wiki/Commons:Copyright_tags', modification: 'Resized and cropped to a square; converted to WebP. Derivative retains the source license.' };
    break;
  }
  if (!selected) { missing.push([key, article]); continue; }
  const buffer = await request(selected.download, false);
  await sharp(buffer).rotate().resize(320, 320, { fit: 'cover', position: cropFor(key) }).webp({ quality: 82 }).toFile(fileURLToPath(new URL(selected.file, destination)));
  manifest[key] = selected;
  used.set(article, key);
  await writeFile(new URL('sources.json', destination), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${key}: ${selected.original} (${selected.license})`);
}
await writeFile(new URL('sources.json', destination), `${JSON.stringify(manifest, null, 2)}\n`);
if (missing.length) console.log('Missing photos:', JSON.stringify(missing));
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const unique = [...new Map(Object.values(manifest).map(photo => [photo.file, photo])).values()];
await writeFile(new URL('credits.html', destination), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Topic image credits · Meow Guru</title><style>body{font:16px/1.6 system-ui;max-width:900px;margin:auto;padding:24px;color:#172033;background:#fafafa}article{display:flex;gap:20px;padding:20px 0;border-bottom:1px solid #ddd}img{width:96px;height:96px;object-fit:cover;border-radius:12px}h2{font-size:18px;margin:0}p{margin:4px 0}a{color:#0063cc}small{color:#596579}</style><h1>Topic image credits</h1><p>Historical artifacts, landmarks and everyday objects from Wikimedia Commons. Each square crop retains its original license.</p>${unique.map(photo => `<article id="${escape(photo.file.replace('.webp', ''))}"><img src="${escape(photo.file)}" alt=""><div><h2>${escape(photo.article)}</h2><p>${escape(photo.author)}</p><p><a href="${escape(photo.source)}">Original image</a> · <a href="${escape(photo.licenseUrl)}">${escape(photo.license)}</a></p><small>${escape(photo.modification)}</small></div></article>`).join('')}</html>`);
console.log(`Saved ${unique.length} photographs, ${Object.keys(manifest).length} mappings and public credits.`);
await writeFile(new URL('../lib/topic-photo-files.ts', new URL('./', import.meta.url)), `// Local photograph files; generated by scripts/sync-topic-images.mjs.\nexport const PHOTO_FILES: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(manifest).map(([key, photo]) => [key, photo.file])), null, 2)};\n`);
if (missing.length) process.exitCode = 1;
