import { readdir, readFile } from 'node:fs/promises';
for (const file of await readdir('.lighthouseci')) {
  if (!file.endsWith('.json')) continue;
  const r = JSON.parse(await readFile(`.lighthouseci/${file}`, 'utf8'));
  if (!r.categories) continue;
  console.log(r.requestedUrl, r.categories.performance.score);
  for (const [key, audit] of Object.entries(r.audits)) {
    if (['errors-in-console'].includes(key)) {
      console.log(key, audit.displayValue, JSON.stringify(audit.details?.items?.slice(0, 5))?.slice(0, 3500));
    }
  }
}
