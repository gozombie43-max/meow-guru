import { afterEach, expect, it, vi } from 'vitest';
import { requestResponse } from '@/shared/api/request';
import { startTest } from './api';

vi.mock('@/shared/api/request', () => ({ requestResponse: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it('retains the server explanation and HTTP status when starting a paper fails', async () => {
  vi.mocked(requestResponse).mockResolvedValue(Response.json({ error: 'This paper has no questions' }, { status: 422 }));
  await expect(startTest('ssc-chsl', 'paper', 'token', 'stable-start-key')).rejects.toMatchObject({ message: 'This paper has no questions', status: 422 });
});

it('preserves session-expiry status so instructions can offer sign-in', async () => {
  vi.mocked(requestResponse).mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
  await expect(startTest('ssc-chsl', 'paper', 'token')).rejects.toMatchObject({ status: 401 });
});

it('rejects an incomplete success response before navigating to a broken attempt', async () => {
  vi.mocked(requestResponse).mockResolvedValue(Response.json({ success: true }));
  await expect(startTest('ssc-chsl', 'paper', 'token')).rejects.toMatchObject({ kind: 'parse', message: 'The server could not prepare this paper. Please try again.' });
});

it('starts a valid native paper using a stable idempotency key', async () => {
  const data = { attemptId: 'attempt', paper: { schemaDriven: true, sections: [{ key: 'math', questions: [{ id: 'm001' }] }] } };
  vi.mocked(requestResponse).mockResolvedValue(Response.json(data, { status: 201 }));
  await expect(startTest('ssc-chsl', 'paper', 'token', 'stable-start-key')).resolves.toEqual(data);
  expect(requestResponse).toHaveBeenCalledWith(expect.stringContaining('/ssc-chsl/paper/start'), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Idempotency-Key': 'stable-start-key' }) }));
});
