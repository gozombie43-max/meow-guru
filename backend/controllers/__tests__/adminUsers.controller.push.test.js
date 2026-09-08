import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsersFind = vi.fn();
const mockUsersCountDocuments = vi.fn();
const mockUsersFindOne = vi.fn();
const mockDevicesFind = vi.fn();
const mockDevicesDistinct = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    find: (...args) => mockUsersFind(...args),
    countDocuments: (...args) => mockUsersCountDocuments(...args),
    findOne: (...args) => mockUsersFindOne(...args),
  }),
  getPushDevicesCollection: () => ({
    find: (...args) => mockDevicesFind(...args),
    distinct: (...args) => mockDevicesDistinct(...args),
  }),
  getAuditLogCollection: () => ({ insertOne: vi.fn() }),
}));

vi.mock('../../services/pushNotificationService.js', () => ({ sendPushToUser: vi.fn() }));

import { getUserById, getUsers } from '../adminUsers.controller.js';

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function userCursor(users) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(users),
  };
}

function deviceCursor(devices) {
  return { toArray: vi.fn().mockResolvedValue(devices) };
}

describe('adminUsers.controller push summaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds aggregate Android device details without exposing FIDs', async () => {
    mockUsersFind.mockReturnValueOnce(userCursor([{ id: 'user_1', name: 'Guru' }]));
    mockUsersCountDocuments.mockResolvedValueOnce(1);
    mockDevicesFind.mockReturnValueOnce(deviceCursor([
      { userId: 'user_1', lastSeenAt: '2026-09-08T10:00:00.000Z' },
      { userId: 'user_1', lastSeenAt: '2026-09-08T11:00:00.000Z' },
    ]));

    const res = response();
    await getUsers({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      users: [expect.objectContaining({
        id: 'user_1',
        status: 'active',
        push: {
          androidRegistered: true,
          activeDeviceCount: 2,
          lastSeenAt: '2026-09-08T11:00:00.000Z',
        },
      })],
    }));
    expect(mockDevicesFind).toHaveBeenCalledWith(
      expect.objectContaining({ userId: { $in: ['user_1'] }, enabled: true, platform: 'android' }),
      expect.any(Object)
    );
  });

  it('filters by enabled Android registrations before paging', async () => {
    mockDevicesDistinct.mockResolvedValueOnce(['user_android']);
    mockUsersFind.mockReturnValueOnce(userCursor([]));
    mockUsersCountDocuments.mockResolvedValueOnce(0);

    const res = response();
    await getUsers({ query: { push: 'android' } }, res);

    expect(mockUsersFind).toHaveBeenCalledWith(
      expect.objectContaining({ id: { $in: ['user_android'] } }),
      expect.any(Object)
    );
    expect(mockDevicesDistinct).toHaveBeenCalledWith('userId', { enabled: true, platform: 'android' });
  });

  it('returns the same summary in the user drawer payload', async () => {
    mockUsersFindOne.mockResolvedValueOnce({ id: 'user_1', name: 'Guru' });
    mockDevicesFind.mockReturnValueOnce(deviceCursor([
      { lastSeenAt: '2026-09-08T11:00:00.000Z' },
    ]));

    const res = response();
    await getUserById({ params: { id: 'user_1' } }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      push: { androidRegistered: true, activeDeviceCount: 1, lastSeenAt: '2026-09-08T11:00:00.000Z' },
    }));
  });
});
