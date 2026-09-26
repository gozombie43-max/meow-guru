import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const config = createRequire(import.meta.url)('../lighthouserc.cjs');
const required = new Map(config.ci.collect.url.map(url => [new URL(url).pathname, 0]));
let checked = 0;
for (const file of await readdir('.lighthouseci')) {
  if (!file.endsWith('.json')) continue;
  const report = JSON.parse(await readFile(`.lighthouseci/${file}`, 'utf8'));
  if (!report.requestedUrl || !report.categories) continue;
  checked++;
  const requested = new URL(report.requestedUrl).pathname;
  const final = new URL(report.finalDisplayedUrl ?? report.finalUrl).pathname;
  if (requested !== final) throw new Error(`Lighthouse measured a redirect: ${requested} -> ${final}`);
  if (report.runtimeError) throw new Error(`Lighthouse runtime error on ${requested}`);
  if (report.audits['errors-in-console']?.details?.items?.length) throw new Error(`Browser errors during Lighthouse on ${requested}`);
  if (report.configSettings?.formFactor !== 'mobile') throw new Error(`Expected mobile measurement for ${requested}`);
  required.set(requested, (required.get(requested) ?? 0) + 1);
  const endpoint = requested.startsWith('/play/session/') ? '/api/training/sessions/lighthouse-training'
    : requested === '/play' ? '/api/training/dashboard'
    : requested.includes('/quiz') ? '/api/questions/session'
    : requested.includes('/attempt') ? '/api/mocktest/' : null;
  if (endpoint && !report.audits['network-requests']?.details?.items?.some(item => item.url.includes(endpoint) && (item.statusCode === 200 || item.statusCode === 201))) {
    throw new Error(`Lighthouse did not load successful question/session data for ${requested}`);
  }
  console.log(JSON.stringify({ route: requested, score: report.categories.performance.score,
    lcpMs: Math.round(report.audits['largest-contentful-paint'].numericValue),
    tbtMs: Math.round(report.audits['total-blocking-time'].numericValue),
    cls: report.audits['cumulative-layout-shift'].numericValue }));
}
for (const [route, runs] of required) {
  if (runs < config.ci.collect.numberOfRuns) throw new Error(`Missing Lighthouse runs for ${route}: ${runs}`);
}
console.log(`Verified ${checked} Lighthouse runs reached their requested routes.`);
