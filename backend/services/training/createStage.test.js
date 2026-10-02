import { expect, it, vi } from 'vitest';
import { measureTrainingCreate } from './createStage.js';
import { trainingCreateStageDuration } from '../../infrastructure/metrics.js';

vi.mock('../../infrastructure/logger.js', () => ({ logger: { info: vi.fn() } }));

it('records successful and failed stages while preserving values and original errors', async () => {
  trainingCreateStageDuration.reset();
  const value = { questions: ['private-document'] };
  expect(await measureTrainingCreate('pool', () => value)).toBe(value);
  const error = new Error('private-provider-message');
  await expect(measureTrainingCreate('pool', () => { throw error; })).rejects.toBe(error);
  const metrics = (await trainingCreateStageDuration.get()).values.filter(value => value.metricName.endsWith('_count'));
  expect(metrics.map(value => ({ labels: value.labels, count: value.value }))).toEqual([
    { labels: { stage: 'pool', outcome: 'success' }, count: 1 },
    { labels: { stage: 'pool', outcome: 'error' }, count: 1 },
  ]);
  expect(JSON.stringify(metrics)).not.toContain('private-');
});
