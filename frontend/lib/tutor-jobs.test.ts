import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { waitForTutorJob } from './tutor-jobs';
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe('attachment job polling', () => {
  it('honors Retry-After and grows the interval while a job remains pending', async () => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockResolvedValueOnce({ data: { jobId: 'job', status: 'queued' }, headers: { 'retry-after': '5' } })
      .mockResolvedValueOnce({ data: { jobId: 'job', status: 'running' } })
      .mockResolvedValueOnce({ data: { jobId: 'job', status: 'completed', success: true, reply: 'Answer' } });
    const promise = waitForTutorJob('job');
    await vi.advanceTimersByTimeAsync(4999);
    expect(api.get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.get).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2399);
    expect(api.get).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('Answer');
  });
  it('pauses hidden tabs and checks immediately when they become visible', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    vi.mocked(api.get).mockResolvedValueOnce({ data: { jobId: 'job', status: 'completed', success: true, reply: 'Ready' } });
    const promise = waitForTutorJob('job');
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.get).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange'));
    await expect(promise).resolves.toBe('Ready');
    visibility.mockRestore();
  });
  it('waits through queued and running states before returning the reply', async () => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockResolvedValueOnce({ data: { jobId: 'job', status: 'queued' } }).mockResolvedValueOnce({ data: { jobId: 'job', status: 'running' } }).mockResolvedValueOnce({ data: { jobId: 'job', status: 'completed', success: true, reply: 'Answer' } });
    const result = waitForTutorJob('job');
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('Answer');
    expect(api.get).toHaveBeenCalledTimes(3);
  });
  it('surfaces terminal errors and stops polling after unmount', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { jobId: 'job', status: 'failed', error: 'Unreadable PDF' } });
    await expect(waitForTutorJob('job')).rejects.toThrow('Unreadable PDF');
    const controller = new AbortController();
    controller.abort();
    await expect(waitForTutorJob('job', controller.signal)).rejects.toThrow();
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
