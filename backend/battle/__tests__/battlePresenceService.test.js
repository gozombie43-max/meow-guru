import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetchSockets: vi.fn(), in: vi.fn() }));
vi.mock('../battleRealtime.js', () => ({ getBattleRealtimeServer: () => ({ in: mocks.in }) }));
import { getOnlineBattleUsers } from '../battlePresenceService.js';
describe('batch battle presence', () => {
  it('uses one room-union query and handles multiple sockets for one student', async () => {
    mocks.in.mockReturnValue({ fetchSockets: mocks.fetchSockets });
    mocks.fetchSockets.mockResolvedValue([{ rooms: new Set(['socket1', 'user:a']) }, { rooms: new Set(['socket2', 'user:a']) }]);
    expect(await getOnlineBattleUsers(['a', 'b', 'a'])).toEqual({ a: true, b: false });
    expect(mocks.in).toHaveBeenCalledWith(['user:a', 'user:b']);
    expect(mocks.fetchSockets).toHaveBeenCalledTimes(1);
  });
  it('surfaces presence failures instead of reporting everyone offline', async () => {
    mocks.fetchSockets.mockRejectedValue(new Error('adapter unavailable'));
    await expect(getOnlineBattleUsers(['a'])).rejects.toThrow('adapter unavailable');
  });
});
