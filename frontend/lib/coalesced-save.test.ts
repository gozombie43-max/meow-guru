import { describe, expect, it, vi } from 'vitest';
import { createCoalescedSave } from './coalesced-save';

describe('coalesced persistence', () => {
  it('skips clean checkpoints and coalesces slow pending saves before flushing final state', async () => {
    let release!: () => void;
    const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
    const saver = createCoalescedSave<number>(write, (a, b) => a === b);
    saver.seed(0);
    await saver.save(0);
    expect(write).not.toHaveBeenCalled();
    const first = saver.save(1);
    const stale = saver.save(2);
    const final = saver.save(3);
    release();
    await Promise.all([first, stale, final]);
    expect(write.mock.calls.map(call => call[0])).toEqual([1, 3]);
    await saver.save(3);
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('does not mark failed state saved and can retry it', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const saver = createCoalescedSave<number>(write, (a, b) => a === b);
    await expect(saver.save(1)).rejects.toThrow('offline');
    await saver.save(1);
    expect(write).toHaveBeenCalledTimes(2);
  });
});
