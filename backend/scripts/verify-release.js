// Read-only deployed readiness check. Explicit targets prevent accidental traffic
// to production when this command is invoked without configuration.
const base = process.env.RELEASE_CHECK_URL;
if (!base) throw new Error('Set RELEASE_CHECK_URL to the staging backend URL');
const parsed = new URL(base);
if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Expected HTTP(S) URL');
const checks = [];
const expectedRelease = process.env.EXPECTED_RELEASE_ID;
for (const path of ['/live', '/health', '/api/health']) {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000), redirect: 'error' });
    const body = await response.json();
    const releaseMatches = path === '/live' || !expectedRelease || body.releaseId === expectedRelease;
    checks.push({ path, status: response.status, ok: response.ok && body.ok === true && releaseMatches, durationMs: Math.round(performance.now() - started), mode: body.mode, releaseId: body.releaseId ?? null, releaseMatches });
  } catch (error) {
    checks.push({ path, ok: false, durationMs: Math.round(performance.now() - started), errorType: error.name });
  }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2));
if (checks.some(check => !check.ok)) process.exitCode = 1;
