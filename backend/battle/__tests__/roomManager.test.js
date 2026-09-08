import { beforeEach, describe, expect, it, vi } from 'vitest';

const collection = {
  insertOne: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
};

vi.mock('../../config/mongodb.js', () => ({
  getBattleRoomsCollection: () => collection,
  getBattleSeasonsCollection: () => ({ findOne: vi.fn().mockResolvedValue(null) }),
}));

const {
  createRoom,
  joinRoom,
  setQuestions,
  submitAnswer,
  resolveExpiredQuestion,
  advanceQuestion,
  markSocketDisconnected,
  findResumableRoomForUser,
  resumePlayerConnection,
  buildBattleSnapshot,
} = await import('../roomManager.js');

const waitingRoom = {
  _id: 'mongo-id',
  code: '4821',
  ownerUserId: 'user-host',
  subject: 'mathematics',
  topic: 'percentages',
  questionCount: 2,
  questions: [],
  currentIndex: 0,
  players: [{
    userId: 'user-host', socketId: 'socket-host', name: 'Host',
    score: 0, answered: false, connected: true,
  }],
  status: 'waiting',
};

describe('Battle Room Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists a user-keyed waiting room with a two-hour expiry', async () => {
    collection.insertOne.mockResolvedValueOnce({ insertedId: 'mongo-id' });

    const code = await createRoom(
      'socket-host', 'Host', 'mathematics', 'percentages', 2, 'user-host'
    );

    expect(code).toMatch(/^\d{4}$/);
    expect(collection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      code,
      ownerUserId: 'user-host',
      status: 'waiting',
      players: [expect.objectContaining({
        userId: 'user-host', socketId: 'socket-host', connected: true,
      })],
      expiresAt: expect.any(Date),
    }));
  });

  it('atomically adds a second player and returns an array-backed room', async () => {
    const joinedRoom = {
      ...waitingRoom,
      players: [...waitingRoom.players, {
        userId: 'user-guest', socketId: 'socket-guest', name: 'Guest',
        score: 0, answered: false, connected: true,
      }],
    };
    collection.findOne.mockResolvedValueOnce(null);
    collection.findOneAndUpdate.mockResolvedValueOnce(joinedRoom);

    const result = await joinRoom('4821', 'socket-guest', 'Guest', 'user-guest');

    expect(result.room.players).toHaveLength(2);
    expect(result.room.players[1].userId).toBe('user-guest');
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'waiting' }),
      expect.objectContaining({ $push: expect.any(Object) }),
      expect.any(Object)
    );
  });

  it('rebinds an existing player to a replacement socket', async () => {
    collection.findOne.mockResolvedValueOnce(waitingRoom);
    collection.findOneAndUpdate.mockResolvedValueOnce(waitingRoom);

    const result = await joinRoom('4821', 'socket-reconnected', 'Host', 'user-host');

    expect(result.resumed).toBe(true);
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      { code: '4821' },
      expect.objectContaining({
        $set: expect.objectContaining({
          'players.$[player].socketId': 'socket-reconnected',
        }),
      }),
      expect.objectContaining({ arrayFilters: [{ 'player.userId': 'user-host' }] })
    );
  });

  it('activates the room when questions are persisted', async () => {
    const active = { ...waitingRoom, questions: [{ correctAnswer: 'A' }], status: 'active' };
    collection.findOneAndUpdate.mockResolvedValueOnce(active);

    const room = await setQuestions('4821', active.questions);

    expect(room.status).toBe('active');
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      { code: '4821', status: 'waiting' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'active' }) }),
      expect.any(Object)
    );
  });

  it('submits an answer by user ID and exposes user-keyed scores', async () => {
    const active = {
      ...waitingRoom,
      status: 'active',
      questions: [{ correctAnswer: 0, options: ['A', 'B'] }],
      players: [
        { ...waitingRoom.players[0], answered: false },
        { userId: 'user-guest', socketId: 'socket-guest', name: 'Guest', score: 0, answered: false },
      ],
    };
    const updated = {
      ...active,
      players: [{ ...active.players[0], answered: true, score: 10, lastAnswer: 'A', lastCorrect: true }, active.players[1]],
    };
    collection.findOne.mockResolvedValueOnce(active).mockResolvedValueOnce(updated);
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const result = await submitAnswer({ code: '4821', userId: 'user-host', questionIndex: 0, selectedIndex: 0 });

    expect(result.isCorrect).toBe(true);
    expect(result.scores['user-host'].score).toBe(10);
    expect(result.scores['socket-host']).toBeUndefined();
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ currentIndex: 0, questionDeadline: { $gte: expect.any(Date) } }),
      expect.objectContaining({ $inc: { 'players.$[player].score': 10 } }),
      expect.any(Object)
    );
  });

  it('accepts option-text answer keys used by uploaded question documents', async () => {
    const active = {
      ...waitingRoom,
      status: 'active',
      questions: [{ correctAnswer: 'New Delhi', options: ['Mumbai', 'New Delhi'] }],
      players: [
        { ...waitingRoom.players[0], answered: false },
        { userId: 'user-guest', socketId: 'socket-guest', name: 'Guest', score: 0, answered: false },
      ],
    };
    const updated = { ...active, players: [{ ...active.players[0], answered: true, score: 10, lastCorrect: true }, active.players[1]] };
    collection.findOne.mockResolvedValueOnce(active).mockResolvedValueOnce(updated);
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const result = await submitAnswer({ code: '4821', userId: 'user-host', questionIndex: 0, selectedIndex: 1 });

    expect(result.ok).toBe(true);
    expect(result.isCorrect).toBe(true);
  });

  it('atomically records one timeout log for each still-unanswered player', async () => {
    const deadline = new Date('2026-09-08T00:00:00.000Z');
    const now = new Date('2026-09-08T00:00:01.000Z');
    const active = {
      ...waitingRoom,
      status: 'active',
      currentIndex: 0,
      questionStartedAt: new Date('2026-09-07T23:59:30.000Z'),
      questionDeadline: deadline,
      questions: [{ correctAnswer: 0, options: ['A', 'B'] }],
      players: [
        { ...waitingRoom.players[0], answered: true, answerLog: [{ questionIndex: 0 }] },
        { userId: 'user-guest', name: 'Guest', score: 0, answered: false, answerLog: [] },
      ],
    };
    const resolved = {
      ...active,
      questionResolvedAt: now,
      questionResolutionIndex: 0,
      questionAdvanceAt: new Date(now.getTime() + 2_000),
      players: [active.players[0], { ...active.players[1], answered: true, timedOut: true }],
    };
    collection.findOne.mockResolvedValueOnce(active).mockResolvedValueOnce(resolved);
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const result = await resolveExpiredQuestion('4821', 0, now);

    expect(result.resolved).toBe(true);
    expect(result.readyToAdvance).toBe(false);
    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        currentIndex: 0,
        questionDeadline: { $lte: now },
        players: { $elemMatch: { answered: false } },
      }),
      expect.objectContaining({
        $push: {
          'players.$[player].answerLog': expect.objectContaining({
            questionIndex: 0,
            selectedIndex: null,
            correct: false,
            timedOut: true,
          }),
        },
      }),
      { arrayFilters: [{ 'player.answered': false }] }
    );
  });

  it('marks a disconnected socket without deleting its room', async () => {
    collection.findOne.mockResolvedValueOnce(waitingRoom);
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const found = await markSocketDisconnected('socket-host');

    expect(found.code).toBe('4821');
    expect(collection.deleteOne).not.toHaveBeenCalled();
    expect(collection.updateOne).toHaveBeenCalledWith(
      { code: '4821', 'players.socketId': 'socket-host' },
      expect.objectContaining({ $set: expect.objectContaining({ 'players.$[player].connected': false }) }),
      expect.any(Object)
    );
  });

  it('uses the expected index guard when advancing a completed question', async () => {
    const active = {
      ...waitingRoom,
      status: 'active',
      currentIndex: 0,
      questions: [{ correctAnswer: 'A' }, { correctAnswer: 'B' }],
      players: [{ ...waitingRoom.players[0], answered: true }, { userId: 'user-guest', answered: true }],
    };
    const advanced = { ...active, currentIndex: 1, players: active.players.map((player) => ({ ...player, answered: false })) };
    collection.findOne.mockResolvedValueOnce(active);
    collection.findOneAndUpdate.mockResolvedValueOnce(advanced);

    const result = await advanceQuestion('4821', 0);

    expect(result.advanced).toBe(true);
    expect(result.finished).toBe(false);
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      { code: '4821', status: 'active', currentIndex: 0 },
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('finds a preferred resumable room only for its authenticated player', async () => {
    collection.findOne.mockResolvedValueOnce(waitingRoom);

    const room = await findResumableRoomForUser('user-host', '4821');

    expect(room.code).toBe('4821');
    expect(collection.findOne).toHaveBeenCalledWith(expect.objectContaining({
      code: '4821',
      'players.userId': 'user-host',
    }));
  });

  it('rebinds a resumable player and never exposes answer data in its snapshot', async () => {
    const active = {
      ...waitingRoom,
      status: 'active',
      questions: [{ question: 'Safe question', options: ['A', 'B'], correctAnswer: 'A', solution: 'secret' }],
      players: [{ ...waitingRoom.players[0], answered: true, lastCorrect: true }],
    };
    collection.findOne.mockResolvedValueOnce(active);
    collection.findOneAndUpdate.mockResolvedValueOnce(active);

    const resumed = await resumePlayerConnection({
      code: '4821', userId: 'user-host', socketId: 'socket-new',
    });
    const snapshot = buildBattleSnapshot(resumed.room, 'user-host');

    expect(resumed.previousSocketId).toBe('socket-host');
    expect(snapshot.currentQuestion).toEqual({
      question: 'Safe question', options: ['A', 'B'], questionIndex: 0, total: 1,
      deadline: null,
    });
    expect(snapshot.myAnswered).toBe(true);
    expect(snapshot.mySelectedIndex).toBeNull();
    expect(snapshot.reveal).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain('correctAnswer');
    expect(JSON.stringify(snapshot)).not.toContain('secret');
  });
});
