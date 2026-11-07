import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoom, deleteRoom, getRoom } from '../../battle/roomManager.js';
import { signBattleRematchToken } from '../../auth/jwt.js';

const mockUsersCollection = {
  updateOne: vi.fn().mockResolvedValue({}),
  findOne: vi.fn(),
};

const mockFriendshipsCollection = {
  findOne: vi.fn().mockResolvedValue({ status: 'accepted' }),
};

const battleRooms = new Map();
const mockBattleRoomsCollection = {
  insertOne: vi.fn(async (room) => {
    if (battleRooms.has(room.code)) {
      const error = new Error('duplicate code');
      error.code = 11000;
      throw error;
    }
    battleRooms.set(room.code, structuredClone(room));
  }),
  findOne: vi.fn(async (filter) => {
    for (const room of battleRooms.values()) {
      if (filter.code && room.code !== filter.code) continue;
      if (
        filter['players.userId'] &&
        !room.players.some((player) => player.userId === filter['players.userId'])
      ) {
        continue;
      }
      return structuredClone(room);
    }
    return null;
  }),
  deleteOne: vi.fn(async ({ code }) => ({
    deletedCount: battleRooms.delete(code) ? 1 : 0,
  })),
  findOneAndUpdate: vi.fn(async ({ code, ownerUserId }, update) => {
    const room = battleRooms.get(code);
    if (
      !room ||
      room.ownerUserId !== ownerUserId ||
      (room.allowedOpponentUserId &&
        room.allowedOpponentUserId !== update.$set.allowedOpponentUserId)
    ) {
      return null;
    }
    Object.assign(room, update.$set);
    return structuredClone(room);
  }),
};

const mockSendPushToUser = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  withMongoTransaction: (work) => work({ session: {} }),
  getQuestionsCollection: vi.fn(),
  getUsersCollection: () => mockUsersCollection,
  getBattleFriendshipsCollection: () => mockFriendshipsCollection,
  getBattleRoomsCollection: () => mockBattleRoomsCollection,
  getBattleSeasonsCollection: () => ({ findOne: vi.fn().mockResolvedValue(null) }),
  getSocketIoAdapterCollection: () => ({}),
}));

vi.mock('../../battle/battleLifecycle.js', () => ({
  battleFailureMessage: (error, fallback) => error.message || fallback,
  claimBattleLease: vi.fn(),
  releaseBattleLeases: vi.fn(),
  allowBattleAction: vi.fn().mockResolvedValue(true),
  BattleBusyError: class extends Error {},
}));

vi.mock('@socket.io/mongo-adapter', () => ({
  createAdapter: () => () => ({}),
}));

vi.mock('../../services/pushNotificationService.js', () => ({
  sendPushToUser: (...args) => mockSendPushToUser(...args),
}));

let connectionHandler;
let lastServerOptions;

vi.mock('socket.io', () => ({
  Server: class MockServer {
    constructor(_httpServer, options) {
      lastServerOptions = options;
      this.use = vi.fn();
      this.on = (evt, fn) => {
        if (evt === 'connection') connectionHandler = fn;
      };
      this.to = () => this;
      this.emit = vi.fn();
      this.adapter = vi.fn();
    }
  },
}));

const { initBattleSocket } = await import('../../battle/battleSocket.js');

function createMockSocket(id, user) {
  const handlers = {};
  const socket = {
    id,
    user,
    join: vi.fn(),
    leave: vi.fn(),
    use: vi.fn(),
    once: vi.fn(),
    authorization: { get: vi.fn().mockResolvedValue(user), close: vi.fn() },
    emit: vi.fn(),
    on: (evt, handler) => {
      handlers[evt] = handler;
    },
  };
  connectionHandler(socket);
  return { socket, handlers };
}

describe('VULN-08 Regression: Battle Socket CORS, Per-User Cooldowns, Rematch Replay & Invite Lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    battleRooms.clear();
    lastServerOptions = null;
    initBattleSocket({}, 'https://meowguru.example.com');
  });

  it('excludes localhost origins from Socket.IO CORS allowlist when NODE_ENV is production', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFrontendUrl = process.env.FRONTEND_URL;
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://meowguru.example.com';
    try {
      initBattleSocket({}, 'https://meowguru.example.com');
      const origins = lastServerOptions?.cors?.origin;
      expect(Array.isArray(origins)).toBe(true);
      expect(origins).toContain('https://meowguru.example.com');
      expect(origins).not.toContain('http://localhost:3000');
      expect(origins).not.toContain('http://localhost:5000');
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prevFrontendUrl;
    }
  });

  it('enforces room:invite 10-second cooldown per user across multiple socket connections', async () => {
    const user = { id: 'host_user_1', email: 'host@test.com', name: 'HostGuru' };
    const conn1 = createMockSocket('socket_1', user);
    const conn2 = createMockSocket('socket_2', user);

    const code = await createRoom('socket_1', 'HostGuru', 'mathematics', 'all', 10, user.id);
    try {
      mockUsersCollection.findOne.mockResolvedValue({ id: 'friend_id', status: 'active' });
      mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

      await conn1.handlers['room:invite']({ code, email: 'friend@test.com' });
      expect(conn1.socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: true,
        message: 'Battle invite sent!',
      });

      // Immediately attempting another invite from a second socket of the SAME user must be rate-limited
      await conn2.handlers['room:invite']({ code, email: 'friend@test.com' });
      expect(conn2.socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'Please wait before sending another invite.',
      });
    } finally {
      await deleteRoom(code);
    }
  });

  it('prevents replaying a consumed rematchToken after cooldown expires', async () => {
    vi.useFakeTimers();
    try {
      const user = { id: 'rematch_user_1', email: 'u1@test.com', name: 'Player One' };
      const { socket, handlers } = createMockSocket('socket_rematch_1', user);
      mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

      const rematchToken = signBattleRematchToken({
        requesterUserId: user.id,
        opponentUserId: 'user_2',
        opponentName: 'Player Two',
        subject: 'mathematics',
        topic: 'percentages',
        questionCount: 10,
      });

      await handlers['battle:rematch']({
        rematchToken,
        playerName: 'Player One',
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'battle:rematchResult',
        expect.objectContaining({ ok: true })
      );

      socket.emit.mockClear();
      // Advance clock past the 10s rate-limit window, within the 10m JWT expiry
      vi.advanceTimersByTime(15_000);

      // Replaying the exact same rematchToken must be rejected
      await handlers['battle:rematch']({
        rematchToken,
        playerName: 'Player One',
      });

      expect(socket.emit).toHaveBeenCalledWith('battle:rematchResult', {
        ok: false,
        message: 'Rematch request is invalid or expired.',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not permanently lock room allowedOpponentUserId when push delivery fails due to noDevices', async () => {
    vi.useFakeTimers();
    try {
      const user = { id: 'host_lock_test', email: 'host@test.com', name: 'HostGuru' };
      const { socket, handlers } = createMockSocket('socket_lock', user);
      const code = await createRoom(socket.id, 'HostGuru', 'mathematics', 'all', 10, user.id);

      // First invite to user_no_devices fails because they have no push devices
      mockUsersCollection.findOne.mockResolvedValueOnce({
        id: 'user_no_devices',
        status: 'active',
      });
      mockSendPushToUser.mockResolvedValueOnce({
        noDevices: true,
        successCount: 0,
        failureCount: 0,
      });

      await handlers['room:invite']({ code, email: 'nodevices@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'Invite could not be delivered.',
      });

      // Room must NOT be locked to user_no_devices after a failed invite delivery
      const roomAfterFailedInvite = await getRoom(code);
      expect(roomAfterFailedInvite.allowedOpponentUserId).toBeNull();

      // Advance past 10s invite cooldown and invite a second user with active push devices
      vi.advanceTimersByTime(11_000);
      socket.emit.mockClear();

      mockUsersCollection.findOne.mockResolvedValueOnce({
        id: 'user_with_devices',
        status: 'active',
      });
      mockSendPushToUser.mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
      });

      await handlers['room:invite']({ code, email: 'withdevices@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: true,
        message: 'Battle invite sent!',
      });

      const roomAfterSecondInvite = await getRoom(code);
      expect(roomAfterSecondInvite.allowedOpponentUserId).toBe('user_with_devices');

      await deleteRoom(code);
    } finally {
      vi.useRealTimers();
    }
  });
});
