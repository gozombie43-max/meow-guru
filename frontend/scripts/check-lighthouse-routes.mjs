import { readdir, readFile } from 'node:fs/promises';
let checked = 0;
for (const file of await readdir('.lighthouseci')) {
  if (!file.endsWith('.json')) continue;
  const report = JSON.parse(await readFile(`.lighthouseci/${file}`, 'utf8'));
  if (!report.requestedUrl || !report.categories) continue;
  checked++;
  const requested = new URL(report.requestedUrl).pathname;
  const final = new URL(report.finalDisplayedUrl ?? report.finalUrl).pathname;
  if (requested !== final) throw new Error(`Lighthouse measured a redirect: ${requested} -> ${final}`);
}
if (checked < 6) throw new Error(`Expected six Lighthouse runs, found ${checked}`);
console.log(`Verified ${checked} Lighthouse runs reached their requested routes.`);
