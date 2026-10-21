import { pathToFileURL } from 'node:url';

export function verifyGate(needs, mode) {
  const full = needs.policy?.outputs?.full_validation;
  if (!['true', 'false'].includes(full)) throw new Error('Missing or invalid verification policy.');
  const expected = mode === 'fast'
    ? Object.fromEntries(['policy', 'lint-and-typecheck', 'frontend-tests', 'backend-tests', 'security-and-vulnerability-scan', 'build-and-analyze'].map(job => [job, 'success']))
    : mode === 'release'
      ? { policy: 'success', 'fast-quality-gate': 'success', 'browser-regression': full === 'true' ? 'success' : 'skipped', lighthouse: full === 'true' ? 'success' : 'skipped' }
      : null;
  if (!expected) throw new Error(`Unknown gate: ${mode}`);
  if (mode === 'fast') expected['browser-smoke'] = full === 'true' ? 'skipped' : 'success';
  for (const job of Object.keys(needs)) {
    if (!Object.hasOwn(expected, job)) throw new Error(`Unexpected gate dependency: ${job}`);
  }
  for (const [job, result] of Object.entries(expected)) {
    if (needs[job]?.result !== result) throw new Error(`${job}: expected ${result}, received ${needs[job]?.result ?? 'missing'}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyGate(JSON.parse(process.env.RESULTS), process.argv[2]);
  console.log(`${process.argv[2]} verification passed.`);
}
