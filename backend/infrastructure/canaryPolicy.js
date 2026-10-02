export function evaluateCanary({ requests, errors, getP95Ms, answerP95Ms, createP95Ms, ready, releaseMatches, collectedAt, windowSeconds }, now = Date.now()) {
  const failures = [];
  if (!ready || !releaseMatches) failures.push('readiness or release identity failed');
  const age = now - Date.parse(collectedAt);
  if (!Number.isFinite(age) || age < -30_000 || age > 120_000 || !Number.isFinite(windowSeconds) || windowSeconds < 300) failures.push('missing, stale or insufficient observation window');
  if (!Number.isFinite(requests) || requests < 100) failures.push('insufficient sample: at least 100 requests required');
  if (!Number.isFinite(errors) || errors < 0 || errors / Math.max(1, requests) > 0.001) failures.push('99.9% availability objective exceeded');
  for (const [name, observed, budget] of [['GET', getP95Ms, 300], ['answer', answerP95Ms, 350], ['create', createP95Ms, 800]]) {
    if (!Number.isFinite(observed) || observed < 0 || observed > budget) failures.push(`${name} latency objective failed or missing`);
  }
  return { promote: failures.length === 0, action: failures.length ? 'rollback' : 'promote', failures };
}
