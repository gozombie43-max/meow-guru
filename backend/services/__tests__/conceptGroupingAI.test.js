import { afterEach, expect, it, vi } from 'vitest';
import { generateConceptGroups } from '../../ai/conceptGrouping.js';

const create = vi.hoisted(() => vi.fn());
vi.mock('openai', () => ({ default: class { chat = { completions: { create } }; } }));
vi.mock('../../infrastructure/dependencyBoundary.js', () => ({
  backgroundAi: { execute: work => work() }, aiProvider: { execute: work => work() },
}));
afterEach(() => { create.mockReset(); vi.unstubAllEnvs(); });
const response = ids => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ groups: [
  { label: 'Interest Calculations', description: 'Relating principal, rate, and time.', conceptIds: ids },
] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });

it('corrects duplicate and missing IDs before accepting a batch and accounts for retry usage', async () => {
  vi.stubEnv('AZURE_OPENAI_KEY', 'test-key');
  create.mockResolvedValueOnce(response([0, 0])).mockResolvedValueOnce(response([0])).mockResolvedValueOnce(response([0, 1]));
  const generated = await generateConceptGroups({ topic: 'interest' }, ['principal', 'rate']);
  expect(generated.output.groups[0].conceptIds).toEqual([0, 1]);
  expect(create).toHaveBeenCalledTimes(3);
  expect(create.mock.calls[2][0].messages.at(-1).content).toContain('AI omitted concepts');
  expect(generated.usage.total_tokens).toBe(45);
});

it('retries only the invalid chunk and preserves global IDs across chunks', async () => {
  vi.stubEnv('AZURE_OPENAI_KEY', 'test-key');
  const concepts = Array.from({ length: 101 }, (_, i) => `concept ${i}`);
  create.mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, i) => i)))
    .mockResolvedValueOnce(response([1])).mockResolvedValueOnce(response([0]));
  const generated = await generateConceptGroups({ topic: 'interest' }, concepts);
  expect(create).toHaveBeenCalledTimes(3);
  expect(generated.output.groups.flatMap(group => group.conceptIds)).toEqual(Array.from({ length: 101 }, (_, i) => i));
  expect(generated.usage.total_tokens).toBe(45);
});

it('bounds validation retries and never saves incomplete membership', async () => {
  vi.stubEnv('AZURE_OPENAI_KEY', 'test-key');
  create.mockResolvedValue(response([0]));
  await expect(generateConceptGroups({ topic: 'interest' }, ['principal', 'rate'])).rejects.toThrow('AI omitted concepts');
  expect(create).toHaveBeenCalledTimes(3);
});
