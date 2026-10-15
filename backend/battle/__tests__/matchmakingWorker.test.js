import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acquire: vi.fn(), pass: vi.fn().mockResolvedValue([]), emit: vi.fn() }));
vi.mock('../matchmakingLock.js', () => ({ acquireMatchmakingPass: mocks.acquire }));
vi.mock('../matchmakingService.js', () => ({ runMatchmakingPass: mocks.pass, emitMatchFound: mocks.emit }));
import { runBattleMatchmakingWorkerOnce, stopBattleMatchmakingWorker } from '../../services/battleMatchmakingWorker.js';
afterEach(() => { stopBattleMatchmakingWorker(); vi.useRealTimers(); vi.clearAllMocks(); });
it('reduces the scan budget and waits at least five seconds between degraded attempts', async () => {
  vi.useFakeTimers(); const release = vi.fn(), renew = vi.fn();
  mocks.acquire.mockResolvedValue({ acquired: true, degraded: true, release, renew });
  await runBattleMatchmakingWorkerOnce(); await runBattleMatchmakingWorkerOnce();
  expect(mocks.acquire).toHaveBeenCalledOnce(); expect(mocks.pass).toHaveBeenCalledWith({ limit: 4, canContinue: renew });
  expect(release).toHaveBeenCalledOnce(); vi.advanceTimersByTime(5501); await runBattleMatchmakingWorkerOnce();
  expect(mocks.acquire).toHaveBeenCalledTimes(2);
});
it('backs off after a dependency failure and permits recovery', async () => {
  vi.useFakeTimers(); mocks.acquire.mockRejectedValueOnce(new Error('offline'));
  await expect(runBattleMatchmakingWorkerOnce()).rejects.toThrow('offline'); await runBattleMatchmakingWorkerOnce();
  expect(mocks.acquire).toHaveBeenCalledOnce(); vi.advanceTimersByTime(5001);
  mocks.acquire.mockResolvedValueOnce({ acquired: false, degraded: false, release: vi.fn() });
  await runBattleMatchmakingWorkerOnce(); expect(mocks.acquire).toHaveBeenCalledTimes(2);
});
