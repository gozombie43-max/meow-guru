import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { waitForTutorJob } from './tutor-jobs';
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe('attachment job polling', () => {
  it('waits through queued and running states before returning the reply', async () => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'queued' } }).mockResolvedValueOnce({ data: { status: 'running' } }).mockResolvedValueOnce({ data: { status: 'completed', reply: 'Answer' } });
    const result = waitForTutorJob('job');
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('Answer');
    expect(api.get).toHaveBeenCalledTimes(3);
  });
  it('surfaces terminal errors and stops polling after unmount', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { status: 'failed', error: 'Unreadable PDF' } });
    await expect(waitForTutorJob('job')).rejects.toThrow('Unreadable PDF');
    const controller = new AbortController();
    controller.abort();
    await expect(waitForTutorJob('job', controller.signal)).rejects.toThrow();
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
