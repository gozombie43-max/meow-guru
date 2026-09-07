import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoom, deleteRoom } from '../roomManager.js';
import { signBattleRematchToken } from '../../auth/jwt.js';

const mockUsersCollection = {
  findOne: vi.fn(),
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
      if (filter['players.userId'] && !room.players.some((player) => player.userId === filter['players.userId'])) continue;
      return structuredClone(room);
    }
    return null;
  }),
  deleteOne: vi.fn(async ({ code }) => ({ deletedCount: battleRooms.delete(code) ? 1 : 0 })),
};

const mockSendPushToUser = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getQuestionsCollection: vi.fn(),
  getUsersCollection: () => mockUsersCollection,
  getBattleRoomsCollection: () => mockBattleRoomsCollection,
  getBattleSeasonsCollection: () => ({ findOne: vi.fn().mockResolvedValue(null) }),
  getSocketIoAdapterCollection: () => ({}),
}));

vi.mock('@socket.io/mongo-adapter', () => ({
  createAdapter: () => () => ({}),
}));

vi.mock('../../services/pushNotificationService.js', () => ({
  sendPushToUser: (...args) => mockSendPushToUser(...args),
}));

let connectionHandler;
let authMiddleware;

vi.mock('socket.io', () => {
  return {
    Server: class MockServer {
      constructor() {
        this.use = (fn) => { authMiddleware = fn; };
        this.on = (evt, fn) => {
          if (evt === 'connection') connectionHandler = fn;
        };
        this.to = () => this;
        this.emit = vi.fn();
        this.adapter = vi.fn();
      }
    },
  };
});

// Import battleSocket after mocks are in place
const { initBattleSocket, sendBattleResultNotifications } = await import('../battleSocket.js');

describe('Battle Socket - room:invite', () => {
  let socket;
  let socketHandlers = {};

  beforeEach(() => {
    vi.clearAllMocks();
    battleRooms.clear();
    socketHandlers = {};

    initBattleSocket({}, 'http://localhost:3000');

    socket = {
      id: 'socket_host',
      user: { id: 'host_id', email: 'host@test.com', name: 'HostGuru' },
      join: vi.fn(),
      emit: vi.fn(),
      on: (evt, handler) => {
        socketHandlers[evt] = handler;
      },
    };

    connectionHandler(socket);
  });

  it('blocks direct room creation when the new-match kill switch is off', async () => {
    const previous = process.env.BATTLE_NEW_MATCHES_ENABLED;
    process.env.BATTLE_NEW_MATCHES_ENABLED = 'false';
    try {
      await socketHandlers['room:create']({ playerName: 'HostGuru' });
      expect(socket.emit).toHaveBeenCalledWith('room:error', {
        message: 'New battles are temporarily unavailable.',
      });
      expect(socket.join).not.toHaveBeenCalledWith(expect.stringMatching(/^\d{4}$/));
    } finally {
      if (previous === undefined) delete process.env.BATTLE_NEW_MATCHES_ENABLED;
      else process.env.BATTLE_NEW_MATCHES_ENABLED = previous;
    }
  });

  it('rejects invalid room code or email address', async () => {
    await socketHandlers['room:invite']({ code: '12', email: 'invalid' });
    expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
      ok: false,
      message: 'Invalid room code or email address.',
    });
  });

  it('rejects self invite', async () => {
    const code = await createRoom(socket.id, 'HostGuru', 'mathematics', 'all', 10, 'host_id');
    try {
      await socketHandlers['room:invite']({ code, email: 'host@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'You cannot invite yourself.',
      });
    } finally {
      await deleteRoom(code);
    }
  });

  it('rejects when room is not found or not waiting', async () => {
    await socketHandlers['room:invite']({ code: '9999', email: 'friend@test.com' });
    expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
      ok: false,
      message: 'Battle room is no longer waiting for players.',
    });
  });

  it('rejects when caller is not the room host', async () => {
    const code = await createRoom('socket_other', 'Other Host', 'mathematics', 'all', 10, 'other_user_id');
    try {
      await socketHandlers['room:invite']({ code, email: 'friend@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'Only the room host can invite opponents.',
      });
    } finally {
      await deleteRoom(code);
    }
  });

  it('returns generic failure when recipient user does not exist', async () => {
    const code = await createRoom(socket.id, 'HostGuru', 'mathematics', 'all', 10, 'host_id');
    try {
      mockUsersCollection.findOne.mockResolvedValueOnce(null);
      await socketHandlers['room:invite']({ code, email: 'unknown@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'Invite could not be delivered.',
      });
    } finally {
      await deleteRoom(code);
    }
  });

  it('returns generic failure when recipient user is suspended or banned', async () => {
    const code = await createRoom(socket.id, 'HostGuru', 'mathematics', 'all', 10, 'host_id');
    try {
      mockUsersCollection.findOne.mockResolvedValueOnce({ id: 'banned_id', status: 'banned' });
      await socketHandlers['room:invite']({ code, email: 'banned@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'Invite could not be delivered.',
      });
    } finally {
      await deleteRoom(code);
    }
  });

  it('returns generic failure when recipient user has no push devices registered', async () => {
    const code = await createRoom(socket.id, 'HostGuru', 'mathematics', 'all', 10, 'host_id');
    try {
      mockUsersCollection.findOne.mockResolvedValueOnce({ id: 'friend_id', status: 'active' });
      mockSendPushToUser.mockResolvedValueOnce({ noDevices: true, successCount: 0, failureCount: 0 });

      await socketHandlers['room:invite']({ code, email: 'friend@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'Invite could not be delivered.',
      });
    } finally {
      await deleteRoom(code);
    }
  });

  it('successfully delivers battle invite push and notifies caller', async () => {
    const code = await createRoom(socket.id, 'HostGuru', 'mathematics', 'all', 10, 'host_id');
    try {
      mockUsersCollection.findOne.mockResolvedValueOnce({ id: 'friend_id', name: 'Friend', status: 'active' });
      mockSendPushToUser.mockResolvedValueOnce({ successCount: 1, failureCount: 0 });

      await socketHandlers['room:invite']({ code, email: 'friend@test.com' });

      expect(mockSendPushToUser).toHaveBeenCalledWith('friend_id', expect.objectContaining({
        title: 'HostGuru challenged you ⚔️',
        body: 'Join the mathematics battle now.',
        route: `/battle?join=${code}`,
        data: expect.objectContaining({
          type: 'battle_invite',
          roomCode: code,
          hostUserId: 'host_id',
        }),
      }));

      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: true,
        message: 'Battle invite sent!',
      });
    } finally {
      await deleteRoom(code);
    }
  });

  it('enforces 10-second anti-spam cooldown between invites', async () => {
    const code = await createRoom(socket.id, 'HostGuru', 'mathematics', 'all', 10, 'host_id');
    try {
      mockUsersCollection.findOne.mockResolvedValue({ id: 'friend_id', status: 'active' });
      mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

      await socketHandlers['room:invite']({ code, email: 'friend@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: true,
        message: 'Battle invite sent!',
      });

      // Second invite immediately afterwards on same socket
      await socketHandlers['room:invite']({ code, email: 'friend2@test.com' });
      expect(socket.emit).toHaveBeenCalledWith('room:inviteResult', {
        ok: false,
        message: 'Please wait before sending another invite.',
      });
    } finally {
      await deleteRoom(code);
    }
  });
});

describe('Battle Socket - Result Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends win notification to winner and loss notification to loser', async () => {
    mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

    const room = {
      code: 'TEST12',
      subject: 'mathematics',
      topic: 'percentages',
      players: [
        { userId: 'user_a', name: 'Player A', score: 80 },
        { userId: 'user_b', name: 'Player B', score: 60 },
      ],
    };
    const scores = {
      user_a: { score: 80 },
      user_b: { score: 60 },
    };

    await sendBattleResultNotifications(room, scores);

    expect(mockSendPushToUser).toHaveBeenCalledTimes(2);

    // Winner push
    expect(mockSendPushToUser).toHaveBeenCalledWith('user_a', {
      title: 'You Won! 🏆',
      body: 'You defeated Player B 80-60.',
      route: '/battle',
      category: 'battleResults',
      centerKey: 'battle-result:TEST12:user_a',
      data: {
        type: 'battle_result',
        result: 'win',
        score: 80,
        opponentScore: 60,
        opponentName: 'Player B',
        subject: 'mathematics',
        topic: 'percentages',
      },
    });

    // Loser push
    expect(mockSendPushToUser).toHaveBeenCalledWith('user_b', {
      title: 'Battle Finished ⚔️',
      body: 'Player A won 80-60. Ready for a rematch?',
      route: '/battle',
      category: 'battleResults',
      centerKey: 'battle-result:TEST12:user_b',
      data: {
        type: 'battle_result',
        result: 'loss',
        score: 60,
        opponentScore: 80,
        opponentName: 'Player A',
        subject: 'mathematics',
        topic: 'percentages',
      },
    });
  });

  it('sends draw notifications when scores are tied', async () => {
    mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

    const room = {
      subject: 'reasoning',
      topic: 'all',
      players: [
        { userId: 'user_a', name: 'Player A', score: 50 },
        { userId: 'user_b', name: 'Player B', score: 50 },
      ],
    };
    const scores = {
      user_a: { score: 50 },
      user_b: { score: 50 },
    };

    await sendBattleResultNotifications(room, scores);

    expect(mockSendPushToUser).toHaveBeenCalledTimes(2);

    expect(mockSendPushToUser).toHaveBeenCalledWith('user_a', expect.objectContaining({
      title: 'Battle Draw 🤝',
      body: 'You and Player B finished 50-50.',
      data: expect.objectContaining({
        type: 'battle_result',
        result: 'draw',
      }),
    }));

    expect(mockSendPushToUser).toHaveBeenCalledWith('user_b', expect.objectContaining({
      title: 'Battle Draw 🤝',
      body: 'You and Player A finished 50-50.',
      data: expect.objectContaining({
        type: 'battle_result',
        result: 'draw',
      }),
    }));
  });

  it('skips push for players without userId', async () => {
    mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

    const room = {
      subject: 'mathematics',
      players: [
        { userId: null, name: 'Guest A', score: 40 },
        { userId: 'user_b', name: 'Player B', score: 50 },
      ],
    };
    const scores = {
      null: { score: 40 },
      user_b: { score: 50 },
    };

    await sendBattleResultNotifications(room, scores);

    expect(mockSendPushToUser).toHaveBeenCalledTimes(1);
    expect(mockSendPushToUser).toHaveBeenCalledWith('user_b', expect.anything());
  });

  it('safely handles empty room or invalid player count', async () => {
    await sendBattleResultNotifications(null, {});
    await sendBattleResultNotifications({ players: [] }, {});
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});

describe('Battle Socket - battle:rematch', () => {
  let socket;
  let socketHandlers = {};

  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers = {};

    initBattleSocket({}, 'http://localhost:3000');

    socket = {
      id: 'socket_rematch_user',
      user: { id: 'user_1', email: 'user1@test.com', name: 'Player One' },
      join: vi.fn(),
      emit: vi.fn(),
      on: (evt, handler) => {
        socketHandlers[evt] = handler;
      },
    };

    connectionHandler(socket);
  });

  it('rejects rematch with invalid or expired token', async () => {
    await socketHandlers['battle:rematch']({
      rematchToken: 'invalid.rematch.token',
      playerName: 'Player One',
    });

    expect(socket.emit).toHaveBeenCalledWith('battle:rematchResult', {
      ok: false,
      message: 'Rematch request is invalid or expired.',
    });
  });

  it('blocks rematch room creation when the new-match kill switch is off', async () => {
    const previous = process.env.BATTLE_NEW_MATCHES_ENABLED;
    process.env.BATTLE_NEW_MATCHES_ENABLED = 'false';
    try {
      await socketHandlers['battle:rematch']({ rematchToken: 'unused', playerName: 'Player One' });
      expect(socket.emit).toHaveBeenCalledWith('battle:rematchResult', {
        ok: false,
        message: 'New battles are temporarily unavailable.',
      });
      expect(socket.join).not.toHaveBeenCalledWith(expect.stringMatching(/^\d{4}$/));
    } finally {
      if (previous === undefined) delete process.env.BATTLE_NEW_MATCHES_ENABLED;
      else process.env.BATTLE_NEW_MATCHES_ENABLED = previous;
    }
  });

  it('rejects rematch if requester is not the token owner', async () => {
    const rematchToken = signBattleRematchToken({
      requesterUserId: 'different_user',
      opponentUserId: 'user_2',
      opponentName: 'Player Two',
      subject: 'mathematics',
      topic: 'all',
      questionCount: 10,
    });

    await socketHandlers['battle:rematch']({
      rematchToken,
      playerName: 'Player One',
    });

    expect(socket.emit).toHaveBeenCalledWith('battle:rematchResult', {
      ok: false,
      message: 'Rematch request is invalid or expired.',
    });
  });

  it('creates room, notifies opponent via push, and emits success', async () => {
    mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

    const rematchToken = signBattleRematchToken({
      requesterUserId: 'user_1',
      opponentUserId: 'user_2',
      opponentName: 'Player Two',
      subject: 'mathematics',
      topic: 'percentages',
      questionCount: 10,
    });

    await socketHandlers['battle:rematch']({
      rematchToken,
      playerName: 'Player One',
    });

    expect(socket.join).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}$/));
    expect(socket.emit).toHaveBeenCalledWith('room:created', expect.objectContaining({
      playerName: 'Player One',
      code: expect.stringMatching(/^\d{4}$/),
    }));

    expect(mockSendPushToUser).toHaveBeenCalledWith('user_2', expect.objectContaining({
      title: 'Player One wants a rematch ⚔️',
      body: 'Think you can win this time?',
      route: expect.stringMatching(/^\/battle\?join=\d{4}$/),
      data: expect.objectContaining({
        type: 'battle_rematch',
      }),
    }));

    expect(socket.emit).toHaveBeenCalledWith('battle:rematchResult', expect.objectContaining({
      ok: true,
      message: 'Rematch invite sent!',
    }));
  });

  it('enforces 10-second cooldown on rematch requests', async () => {
    mockSendPushToUser.mockResolvedValue({ successCount: 1, failureCount: 0 });

    const rematchToken = signBattleRematchToken({
      requesterUserId: 'user_1',
      opponentUserId: 'user_2',
      opponentName: 'Player Two',
      subject: 'mathematics',
      topic: 'percentages',
      questionCount: 10,
    });

    await socketHandlers['battle:rematch']({
      rematchToken,
      playerName: 'Player One',
    });

    expect(socket.emit).toHaveBeenCalledWith('battle:rematchResult', expect.objectContaining({
      ok: true,
    }));

    // Second request immediately on same socket
    await socketHandlers['battle:rematch']({
      rematchToken,
      playerName: 'Player One',
    });

    expect(socket.emit).toHaveBeenCalledWith('battle:rematchResult', {
      ok: false,
      message: 'Please wait before requesting another rematch.',
    });
  });
});
