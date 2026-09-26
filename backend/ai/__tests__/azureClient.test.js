import { beforeEach, expect, it, vi } from 'vitest';
const { create, constructor } = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock('openai', () => ({ default: class {
  constructor(options) { constructor(options); this.chat = { completions: { create } }; }
} }));
let chatCompleteMessages;
beforeEach(async () => {
  // Vitest 5 clears call history before each test; initialize after that reset.
  vi.resetModules();
  create.mockReset();
  ({ chatCompleteMessages } = await import('../azureClient.js'));
});
it('bounds request duration and disables hidden retry amplification', () => {
  expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 45000, maxRetries: 0 }));
});
it('rejects an empty completion instead of returning a successful empty tutor answer', async () => {
  create.mockResolvedValue({ choices: [{ message: { content: null } }] });
  await expect(chatCompleteMessages([])).rejects.toMatchObject({ statusCode: 502 });
  create.mockResolvedValue({ choices: [{ message: { content: 'Worked solution' } }] });
  await expect(chatCompleteMessages([])).resolves.toBe('Worked solution');
});
