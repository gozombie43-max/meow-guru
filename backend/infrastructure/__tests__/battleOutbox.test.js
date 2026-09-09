import { describe, expect, it, vi } from 'vitest';
import { relayPendingBattles } from '../battleOutbox.js';

describe('battle outbox', () => {
  it('publishes directly through the embedded API and clears the pending marker', async () => {
    const room = {
      _id: 'room-id',
      code: '1234',
      status: 'active',
      realtimeVersion: 7,
      players: [
        { userId: 'user-a', name: 'A', matchmakingRating: 1000 },
        { userId: 'user-b', name: 'B', matchmakingRating: 1050 },
      ],
    };
    const cursor = {
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([room]),
    };
    const rooms = {
      find: vi.fn().mockReturnValue(cursor),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const io = {
      local: { to },
      serverSideEmitWithAck: vi.fn(),
    };

    await relayPendingBattles(rooms, io, { localApi: true });

    expect(to).toHaveBeenCalledWith('user:user-a');
    expect(to).toHaveBeenCalledWith('user:user-b');
    expect(emit).toHaveBeenCalledTimes(2);
    expect(io.serverSideEmitWithAck).not.toHaveBeenCalled();
    expect(rooms.updateOne).toHaveBeenCalledWith(
      { _id: 'room-id', realtimeVersion: 7 },
      { $unset: { realtimeVersion: '' } },
    );
  });
});
