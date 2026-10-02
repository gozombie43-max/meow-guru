import { expect, it } from 'vitest';
import { evaluateCanary } from '../canaryPolicy.js';
const good = { requests: 1000, errors: 0, getP95Ms: 250, answerP95Ms: 300, createP95Ms: 700, ready: true, releaseMatches: true, collectedAt: new Date().toISOString(), windowSeconds: 300 };
it('promotes only measured releases within every objective', () => {
  expect(evaluateCanary(good).promote).toBe(true);
  for (const changed of [{ requests: 10 }, { errors: 2 }, { answerP95Ms: 500 }, { createP95Ms: NaN }, { ready: false }, { releaseMatches: false }, { collectedAt: 'invalid' }, { collectedAt: new Date(0).toISOString() }, { windowSeconds: 60 }, { answerP95Ms: -1 }]) expect(evaluateCanary({ ...good, ...changed }).action).toBe('rollback');
});
