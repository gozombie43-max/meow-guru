import { beforeEach, expect, it, vi } from 'vitest';
import { chatCompleteMessages } from '../../ai/azureClient.js';
import { tutorChat } from '../tutorChatService.js';
vi.mock('../../ai/azureClient.js', () => ({ chatCompleteMessages: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('bounds history and normalizes practice prompts while preserving math', async () => {
  chatCompleteMessages.mockResolvedValue('Practice Questions\nSolve for x.\n$$x + 2 = 4$$\nAnswer: 2');
  const result = await tutorChat({ context: 'Algebra', message: 'Practice', lang: 'bn', history: [...Array(20).fill({ role: 'user', content: 'x'.repeat(5000) }), { role: 'system', content: 'untrusted' }] });
  const messages = chatCompleteMessages.mock.calls[0][0];
  expect(messages.filter(row => row.role === 'system')).toHaveLength(1); expect(messages[0].content).toContain('Bengali');
  expect(messages).toHaveLength(20); expect(messages.slice(3, -1).every(row => row.content.length <= 4000)).toBe(true);
  expect(result.reply).toContain('- Solve for x.'); expect(result.reply).toContain('$$x + 2 = 4$$');
});
it('retries text-only if vision fails and retains the extracted attachment text', async () => {
  chatCompleteMessages.mockRejectedValueOnce(new Error('unsupported image')).mockResolvedValueOnce('**Answer:** 2');
  expect(await tutorChat({ context: 'Algebra', message: '' }, { text: 'Extracted question', imageParts: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,fixture' } }] })).toEqual({ success: true, reply: '**Answer:** 2' });
  expect(chatCompleteMessages).toHaveBeenCalledTimes(2); expect(chatCompleteMessages.mock.calls[1][0].at(-1).content).toContain('Extracted question');
});
it('propagates provider deadlines instead of reporting success', async () => {
  chatCompleteMessages.mockRejectedValue(Object.assign(new Error('deadline'), { statusCode: 504 }));
  await expect(tutorChat({ context: 'Algebra', message: 'help' })).rejects.toMatchObject({ statusCode: 504 });
  expect(chatCompleteMessages).toHaveBeenCalledOnce();
});
