import { beforeEach, expect, it, vi } from 'vitest';
const { create, constructor } = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock('openai', () => ({ default: class {
  constructor(options) { constructor(options); this.chat = { completions: { create } }; }
} }));
import { chatCompleteMessages } from '../azureClient.js';
beforeEach(() => create.mockReset());
it('bounds request duration and disables hidden retry amplification', () => {
  expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 45000, maxRetries: 0 }));
});
it('rejects an empty completion instead of returning a successful empty tutor answer', async () => {
  create.mockResolvedValue({ choices: [{ message: { content: null } }] });
  await expect(chatCompleteMessages([])).rejects.toMatchObject({ statusCode: 502 });
  create.mockResolvedValue({ choices: [{ message: { content: 'Worked solution' } }] });
  await expect(chatCompleteMessages([])).resolves.toBe('Worked solution');
});
