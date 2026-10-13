import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ users: vi.fn(), rooms: vi.fn(), presence: vi.fn(), findUsers: vi.fn(), findRooms: vi.fn(), limit: vi.fn(), friendships: vi.fn() }));
vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({ find: mocks.findUsers }),
  getBattleFriendshipsCollection: () => ({ find: () => ({ toArray: mocks.friendships }) }),
  getBattleRoomsCollection: () => ({ find: mocks.findRooms }),
}));
vi.mock('../battlePresenceService.js', () => ({ getConnectedBattleUserIds: mocks.presence }));
import { getBattleStudents } from '../battleStudentService.js';
describe('student roster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockReturnValue({ toArray: mocks.users });
    mocks.findUsers.mockReturnValue({ sort: () => ({ limit: mocks.limit }) });
    mocks.friendships.mockResolvedValue([]);
    mocks.findRooms.mockReturnValue({ toArray: mocks.rooms });
  });
  it('queries only connected users and reports friendship state without private fields', async () => {
    mocks.presence.mockResolvedValue(['me', 'b', 'c']);
    mocks.users.mockResolvedValue([{ id: 'b', name: 'B', email: 'private' }, { id: 'c', name: 'C' }]);
    mocks.rooms.mockResolvedValue([{ code: '1234', status: 'active', players: [{ userId: 'b' }] }]);
    mocks.friendships.mockResolvedValue([{ users: ['me', 'b'], status: 'accepted' }, { users: ['me', 'c'], status: 'pending', requestedToUserId: 'me' }]);
    const result = await getBattleStudents('me');
    expect(result.students[0]).toMatchObject({ online: true, busy: true, friendship: 'friend', activity: 'In a battle' });
    expect(result.students[1].friendship).toBe('incoming');
    expect(mocks.findUsers.mock.calls[0][0].id).toEqual({ $in: ['b', 'c'] });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('1234');
    expect(mocks.limit).toHaveBeenCalledWith(100);
  });
  it('returns no offline directory when nobody is connected', async () => {
    mocks.presence.mockResolvedValue(['me']);
    expect((await getBattleStudents('me')).students).toEqual([]);
    expect(mocks.findUsers).not.toHaveBeenCalled();
  });
});
