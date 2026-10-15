import { createSession } from '../../auth/sessions.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createServer } from "node:http";
import { io as createSocketClient } from "socket.io-client";

vi.mock("../../services/pushNotificationService.js", () => ({
  sendPushToUser: vi.fn().mockResolvedValue({ noDevices: true, successCount: 0 }),
}));

let replicaSet;
let mongo;
let roomManager;
let resultService;
let matchmakingService;
let progressionService;
let rewardService;
let seasonWorker;
let presenceWorker;
let battleSocket;
let auth;

const collectionNames = [
  "battleRooms", "battleMatches", "battleProfiles", "battleMatchmakingQueue",
  "battleSeasons", "battleSeasonProfiles", "battleSeasonRewards",
  "battleIntegrityEvents", "battleAchievements", "battleMissionProgress",
  "battleProgressEvents", "battleProgressionProfiles", "battleSeasonProgress",
  "battleSeasonRewardClaims", "battleCosmeticInventory",
  "battleMatchmakingLocks", "battleUserLeases", "battleActionLimits", "battleQuestionHistory", "questions",
];

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replicaSet.getUri();
  mongo = await import("../../config/mongodb.js");
  await mongo.connectMongoDB();
  await (await import("../../migrations/runner.js")).migrate(mongo.getMongoDB());
  roomManager = await import("../roomManager.js");
  resultService = await import("../battleResultService.js");
  matchmakingService = await import("../matchmakingService.js");
  progressionService = await import("../battleProgressionService.js");
  rewardService = await import("../battleSeasonRewardService.js");
  seasonWorker = await import("../../services/battleSeasonWorker.js");
  presenceWorker = await import("../../services/battlePresenceWorker.js");
  battleSocket = await import("../battleSocket.js");
  auth = await import("../../auth/jwt.js");
}, 180_000);

afterEach(async () => {
  await Promise.all(collectionNames.map((name) => mongo.getMongoDB().collection(name).deleteMany({})));
});

afterAll(async () => {
  await mongo?.disconnectMongoDB();
  await replicaSet?.stop();
}, 60_000);

function activeRoom(overrides = {}) {
  const deadline = new Date("2026-09-08T00:00:30.000Z");
  return {
    code: "4821", ownerUserId: "user-a", subject: "mathematics", topic: "all",
    mode: 'ranked', origin: 'matchmaking', rated: true, matchmakingId: 'fixture-ranked',
    questionCount: 1, currentIndex: 0, status: "active",
    questionStartedAt: new Date("2026-09-08T00:00:00.000Z"), questionDeadline: deadline,
    questions: [{ question: "1 + 1?", options: ["2", "3"], correctAnswer: 0 }],
    players: [
      { userId: "user-a", name: "A", score: 0, answered: false, connected: true, answerLog: [] },
      { userId: "user-b", name: "B", score: 0, answered: false, connected: true, answerLog: [] },
    ],
    createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000),
    ...overrides,
  };
}

describe("Battle Phase-15 replica-set races", () => {
  it('allows only one lifecycle when private creation races matchmaking across devices', async () => {
    const results = await Promise.allSettled([
      roomManager.createRoom('tab-a', 'A', 'mathematics', 'all', 10, 'user-a'),
      matchmakingService.joinMatchmakingQueue({ userId: 'user-a', displayName: 'A', subject: 'mathematics', topic: 'all', questionCount: 10 }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const db = mongo.getMongoDB();
    expect(await db.collection('battleUserLeases').countDocuments({ userId: 'user-a' })).toBe(1);
    const rooms = await mongo.getBattleRoomsCollection().countDocuments({ 'players.userId': 'user-a', status: 'waiting' });
    const tickets = await mongo.getBattleMatchmakingQueueCollection().countDocuments({ userId: 'user-a', status: 'waiting' });
    expect(rooms + tickets).toBe(1);
  });

  it.each(['social', 'rematch'])('binds %s rooms to their intended opponent and releases cancelled leases', async origin => {
    const code = await roomManager.createRoom('host', 'Host', 'mathematics', 'all', 10, 'host', { origin, allowedOpponentUserId: 'friend' });
    expect(await roomManager.joinRoom(code, 'intruder', 'Intruder', 'intruder')).toEqual({ error: 'This invitation is reserved for another player.' });
    expect(await mongo.getMongoDB().collection('battleUserLeases').countDocuments({ userId: 'intruder' })).toBe(0);
    const joined = await roomManager.joinRoom(code, 'friend-socket', 'Friend', 'friend');
    expect(joined.room.players.map(player => player.userId)).toEqual(['host', 'friend']);
    expect(joined.room).toMatchObject({ origin, mode: 'casual', rated: false });
    await roomManager.deleteRoom(code);
    expect(await mongo.getMongoDB().collection('battleUserLeases').countDocuments({ resourceId: code })).toBe(0);
    await expect(matchmakingService.joinMatchmakingQueue({ userId: 'friend', displayName: 'Friend', subject: 'mathematics', topic: 'all', questionCount: 10 })).resolves.toMatchObject({ status: 'waiting' });
    await matchmakingService.cancelMatchmakingQueue('friend');
    expect(await mongo.getMongoDB().collection('battleUserLeases').countDocuments({ userId: 'friend' })).toBe(0);
  });

  it('limits guessed-code attempts by account across sockets', async () => {
    for (let attempt = 0; attempt < 10; attempt++) await roomManager.joinRoom('NOPE22', `socket-${attempt}`, 'Guesser', 'guesser');
    expect(await roomManager.joinRoom('NOPE22', 'another-device', 'Guesser', 'guesser')).toEqual({ error: 'Too many join attempts. Please wait a minute.' });
  });

  it('commits cancellation or pairing atomically without stranding or freeing a claimed match', async () => {
    await Promise.all(['user-a', 'user-b'].map(userId => matchmakingService.joinMatchmakingQueue({ userId, displayName: userId, subject: 'mathematics', topic: 'all', questionCount: 10 })));
    await Promise.all([matchmakingService.cancelMatchmakingQueue('user-a'), matchmakingService.runMatchmakingPass()]);
    const ticket = await mongo.getBattleMatchmakingQueueCollection().findOne({ userId: 'user-a' });
    const lease = await mongo.getMongoDB().collection('battleUserLeases').findOne({ userId: 'user-a' });
    if (ticket.status === 'cancelled') { expect(lease).toBeNull(); expect(await mongo.getBattleRoomsCollection().countDocuments({})).toBe(0); }
    else { expect(ticket.status).toBe('matched'); expect(lease).toMatchObject({ kind: 'room', resourceId: ticket.roomCode }); }
  });

  it('reserves private email invitations atomically for a single recipient', async () => {
    const code = await roomManager.createRoom('host', 'Host', 'mathematics', 'all', 10, 'host');
    const outcomes = await Promise.all([roomManager.reserveRoomOpponent(code, 'host', 'friend-a'), roomManager.reserveRoomOpponent(code, 'host', 'friend-b')]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const room = await roomManager.getRoom(code);
    const other = room.allowedOpponentUserId === 'friend-a' ? 'friend-b' : 'friend-a';
    expect((await roomManager.joinRoom(code, 'other-socket', 'Other', other)).error).toMatch(/reserved/);
  });

  it.each(['private', 'social', 'rematch'])('records %s results without touching competitive profiles', async origin => {
    const room = activeRoom({ status: 'finished', finishReason: 'forfeit', winnerUserId: 'user-a', origin, mode: 'casual', rated: false, matchmakingId: null });
    await mongo.getBattleProfilesCollection().insertOne({ userId: 'user-a', rating: 1450, gamesPlayed: 8, wins: 4 });
    await mongo.getBattleRoomsCollection().insertOne(room);
    const settlement = await resultService.settleBattleResult(room);
    expect(settlement.match.rated).toBe(false);
    expect(await mongo.getBattleProfilesCollection().findOne({ userId: 'user-a' })).toMatchObject({ rating: 1450, gamesPlayed: 8, wins: 4 });
    expect(await mongo.getBattleProfilesCollection().countDocuments({ userId: 'user-b' })).toBe(0);
    expect(await mongo.getBattleSeasonProfilesCollection().countDocuments({})).toBe(0);
  });

  it('disables Elo settlement for a previously ranked room when the kill switch is off', async () => {
    const previous = process.env.BATTLE_RANKED_ENABLED;
    process.env.BATTLE_RANKED_ENABLED = 'false';
    try {
      const room = activeRoom({ status: 'finished', finishReason: 'completed' });
      await mongo.getBattleRoomsCollection().insertOne(room);
      expect((await resultService.settleBattleResult(room)).match.rated).toBe(false);
      expect(await mongo.getBattleProfilesCollection().countDocuments({})).toBe(0);
    } finally { if (previous === undefined) delete process.env.BATTLE_RANKED_ENABLED; else process.env.BATTLE_RANKED_ENABLED = previous; }
  });

  it('builds reproducible 3/4/3 ranked sets, caps concepts, and excludes both players recent questions', async () => {
    const { battleQuestionMetadata } = await import('../../services/questions/battleQuestionMetadata.js');
    const { buildBattleQuestionSet } = await import('../questionSetBuilder.js');
    const questions = mongo.getMongoDB().collection('questions');
    await questions.insertMany(['easy', 'medium', 'hard'].flatMap((difficulty, bucket) => Array.from({ length: 12 }, (_, index) => {
      const row = { questionUid: `certified-${bucket}-${index}`, question: `${difficulty} question ${index}?`, options: ['A', 'B', 'C', 'D'], correctAnswer: 0,
        subjectKey: 'mathematics', topicKey: 'algebra', concept: `concept-${index % 5}`, difficulty, language: 'en', rankedEligible: true };
      return { ...row, ...battleQuestionMetadata(row) };
    })));
    const room = activeRoom({ code: 'RANK22', questionCount: 10, createdAt: new Date('2026-10-15T00:00:00Z') });
    const options = { histories: [[], []], secret: 'a-secure-deterministic-fixture-secret' };
    const first = await buildBattleQuestionSet(questions, room, options), repeat = await buildBattleQuestionSet(questions, room, options);
    expect(repeat.selectedQuestionIds).toEqual(first.selectedQuestionIds);
    expect(first.questions.filter(row => row.difficulty === 'easy')).toHaveLength(3);
    expect(first.questions.filter(row => row.difficulty === 'medium')).toHaveLength(4);
    expect(first.questions.filter(row => row.difficulty === 'hard')).toHaveLength(3);
    for (const concept of new Set(first.questions.map(row => row.concept))) expect(first.questions.filter(row => row.concept === concept).length).toBeLessThanOrEqual(4);
    const histories = [first.selectedQuestionIds.slice(0, 5), first.selectedQuestionIds.slice(5)].map(ids => ids.map(questionUid => ({ questionUid })));
    const next = await buildBattleQuestionSet(questions, room, { ...options, histories });
    expect(next.selectedQuestionIds.every(id => !first.selectedQuestionIds.includes(id))).toBe(true);
    expect(next.selectionHistoryWindow).toBe(100);
    await expect(buildBattleQuestionSet(questions, { ...room, subject: 'reasoning' }, options)).rejects.toThrow(/not enough certified/i);
  });

  it('advances a persisted reveal after restart without waiting for the question deadline', async () => {
    const room = activeRoom({ code: 'REST22', matchmakingId: 'restart-ranked', questionDeadline: new Date(Date.now() + 60_000),
      questionAdvanceAt: new Date(Date.now() - 1000), questionResolvedAt: new Date(Date.now() - 6000),
      players: [{ userId: 'restart-a', name: 'A', score: 10, answered: true, lastCorrect: true }, { userId: 'restart-b', name: 'B', score: 0, answered: true, lastCorrect: false }] });
    await mongo.getBattleRoomsCollection().insertOne(room);
    await mongo.getMongoDB().collection('battleUserLeases').insertMany(room.players.map(player => ({ _id: player.userId, userId: player.userId, kind: 'room', resourceId: room.code, expiresAt: room.expiresAt })));
    const worker = await import('../../services/battleQuestionDeadlineWorker.js');
    await worker.runBattleQuestionDeadlineWorkerOnce();
    expect((await roomManager.getRoom(room.code)).status).toBe('finished');
    expect(await mongo.getBattleMatchesCollection().countDocuments({ roomCode: room.code })).toBe(1);
    expect(await mongo.getMongoDB().collection('battleUserLeases').countDocuments({ resourceId: room.code })).toBe(0);
  });

  it('takes two real clients from Quick Match through pairing and a certified ranked start', async () => {
    const { battleQuestionMetadata } = await import('../../services/questions/battleQuestionMetadata.js');
    await mongo.getMongoDB().collection('questions').insertMany(['easy', 'medium', 'hard'].flatMap((difficulty, bucket) => Array.from({ length: 10 }, (_, index) => {
      const row = { questionUid: `quick-${bucket}-${index}`, question: `Physics ${bucket}-${index}?`, options: ['A', 'B', 'C', 'D'], correctAnswer: 0,
        subjectKey: 'iitjamphysics', difficulty, concept: `Physics concept ${index % 5}`, rankedEligible: true };
      return { ...row, ...battleQuestionMetadata(row) };
    })));
    const ids = ['quick-a', 'quick-b'];
    await mongo.getUsersCollection().insertMany(ids.map(id => ({ id })));
    const tokens = await Promise.all(ids.map(async id => (await createSession({ id })).token));
    const server = createServer(), io = battleSocket.initBattleSocket(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const clients = tokens.map(token => createSocketClient(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], auth: { token } }));
    const event = (client, name) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 7000); client.once(name, data => { clearTimeout(timer); resolve(data); }); });
    try {
      await Promise.all(clients.map(client => event(client, 'connect')));
      const queued = clients.map(client => event(client, 'matchmaking:queued'));
      for (const client of clients) {
        client.on('matchmaking:matched', ({ roomCode }) => client.emit('battle:resume', { code: roomCode }));
        client.emit('matchmaking:join', { subject: 'iit-jam-physics', topic: 'all', questionCount: 10 });
      }
      await Promise.all(queued);
      const firstQuestions = clients.map(client => event(client, 'game:question'));
      const matches = await matchmakingService.runMatchmakingPass();
      expect(matches).toHaveLength(1);
      matchmakingService.emitMatchFound(matches[0]);
      for (const question of await Promise.all(firstQuestions)) {
        expect(question).toMatchObject({ questionIndex: 0, total: 10 });
        expect(question.correctAnswer).toBeUndefined();
      }
      const stored = await roomManager.getRoom(matches[0].roomCode);
      expect(stored).toMatchObject({ status: 'active', mode: 'ranked', origin: 'matchmaking', rated: true, selectionVersion: 'ranked-v2' });
      expect(stored.selectedQuestionIds).toHaveLength(10);
      expect(await mongo.getMongoDB().collection('battleQuestionHistory').countDocuments({ roomCode: stored.code })).toBe(20);
      expect(await mongo.getMongoDB().collection('battleUserLeases').countDocuments({ resourceId: stored.code, kind: 'room' })).toBe(2);
    } finally { clients.forEach(client => client.disconnect()); await new Promise(resolve => io.close(resolve)); }
  });

  it('does not disclose an answer or its score through sockets or a reconnect until both answers lock', async () => {
    await mongo.getUsersCollection().insertMany([{ id: 'user-a' }, { id: 'user-b' }]);
    const room = activeRoom({ code: 'WIRE22', matchmakingId: 'wire-ranked', questionStartedAt: new Date(), questionDeadline: new Date(Date.now() + 30_000) });
    await mongo.getBattleRoomsCollection().insertOne(room);
    const tokens = await Promise.all(['user-a', 'user-b'].map(async id => (await createSession({ id })).token));
    const server = createServer(), io = battleSocket.initBattleSocket(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const clients = tokens.map(token => createSocketClient(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], auth: { token } }));
    const event = (client, name) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 5000); client.once(name, data => { clearTimeout(timer); resolve(data); }); });
    try {
      await Promise.all(clients.map(client => event(client, 'connect')));
      for (const client of clients) { const resumed = event(client, 'battle:resumed'); client.emit('battle:resume', { code: room.code }); await resumed; }
      const wire = []; clients[1].onAny((name, data) => wire.push({ name, data }));
      const accepted = event(clients[0], 'game:answerResult'), answered = event(clients[1], 'game:opponentAnswered');
      clients[0].emit('game:answer', { code: room.code, questionIndex: 0, selectedIndex: 0 });
      expect(await accepted).toEqual({ questionIndex: 0, accepted: true });
      expect(await answered).toEqual({ questionIndex: 0, userId: 'user-a', answered: true });
      expect(wire.some(item => ['game:opponentAnswer', 'game:scores', 'game:reveal'].includes(item.name))).toBe(false);
      const resumed = event(clients[1], 'battle:resumed'); clients[1].emit('battle:resume', { code: room.code });
      const snapshot = await resumed;
      expect(snapshot.scores['user-a'].score).toBe(0);
      expect(snapshot.scores['user-a'].lastCorrect).toBeUndefined();
      expect(snapshot.scores['user-b'].lastCorrect).toBeUndefined();
      expect(snapshot.reveal).toBeNull();
      const revealed = event(clients[1], 'game:reveal');
      clients[1].emit('game:answer', { code: room.code, questionIndex: 0, selectedIndex: 1 });
      const reveal = await revealed;
      expect(reveal).toMatchObject({ correctIndex: 0, selections: { 'user-a': 0, 'user-b': 1 }, scores: { 'user-a': { score: 10 }, 'user-b': { score: 0 } } });
      expect(new Date(reveal.revealEndsAt).getTime()).toBeGreaterThan(Date.now());
    } finally { clients.forEach(client => client.disconnect()); await new Promise(resolve => io.close(resolve)); }
  });

  it.each([
    { questionType: 'MSQ', options: ['A', 'B', 'C', 'D'], correctAnswer: [0, 2], partialCredit: true, input: { type: 'msq', selectedIndices: [0] }, points: 5 },
    { questionType: 'NAT', correctAnswer: { min: -2, max: 0 }, input: { type: 'nat', numericAnswer: 0 }, points: 10 },
  ])('persists $questionType answers atomically and withholds grading until timeout closes the round', async fixture => {
    const now = new Date(), { input, points, ...question } = fixture;
    const room = activeRoom({ code: 'JAM222', questionStartedAt: new Date(+now - 1000), questionDeadline: new Date(+now + 1000), questions: [{ question: 'JAM item', questionImage: '/q.png', ...question }] });
    await mongo.getBattleRoomsCollection().insertOne(room);
    const attempts = await Promise.all(Array.from({ length: 4 }, () => roomManager.submitAnswer({ code: room.code, userId: 'user-a', questionIndex: 0, ...input, now })));
    expect(attempts.filter(result => result.ok)).toHaveLength(1);
    let stored = await roomManager.getRoom(room.code);
    const before = roomManager.buildBattleSnapshot(stored, 'user-b');
    expect(before.scores['user-a'].score).toBe(0); expect(before.reveal).toBeNull();
    expect(before.currentQuestion.questionImage).toBe('/q.png'); expect(before.currentQuestion).not.toHaveProperty('correctAnswer');
    expect(roomManager.buildBattleSnapshot(stored, 'user-a').myAnswer).toEqual(input);
    await roomManager.resolveExpiredQuestion(room.code, 0, new Date(+now + 30_000));
    stored = await roomManager.getRoom(room.code);
    expect(stored.players[0].score).toBe(points); expect(stored.players[0].answerLog).toHaveLength(1);
    expect(stored.players[1].responseTimeMs).toBe(2000); // deadline, not the delayed worker's arrival
    expect(roomManager.buildBattleReveal(stored).results['user-a'].points).toBe(points);
    expect(roomManager.buildBattleReview(stored, 'user-a')[0].myAnswer.answer).toEqual(input);
  });

  it('sets per-type ranked deadlines and retains casual rooms past their long deadline', async () => {
    for (const [type, duration, mode] of [['MCQ', 20000, 'ranked'], ['MSQ', 30000, 'ranked'], ['NAT', 30000, 'ranked'], ['MCQ', 86400000, 'casual']]) {
      const code = `TIME${type}${mode}`, room = activeRoom({ code, matchmakingId: code, status: 'waiting', mode });
      await mongo.getBattleRoomsCollection().insertOne(room);
      const result = await roomManager.setQuestions(code, [{ question: 'Timed', questionType: type, options: ['a','b'], correctAnswer: type === 'NAT' ? 2 : type === 'MSQ' ? [0] : 0 }]);
      expect(+result.questionDeadline - +result.questionStartedAt).toBe(duration);
      expect(+result.expiresAt).toBeGreaterThan(+result.questionDeadline);
    }
  });

  it('restores a locked MSQ answer after server restart and delivers one consistent tie-break result', async () => {
    const ids = ['restart-a', 'restart-b']; await mongo.getUsersCollection().insertMany(ids.map(id => ({ id })));
    const tokens = await Promise.all(ids.map(async id => (await createSession({ id })).token));
    const room = activeRoom({ code: 'RST222', matchmakingId: 'restart-ranked', questionStartedAt: new Date(), questionDeadline: new Date(Date.now() + 30000),
      questions: [{ question: 'Choose both', questionType: 'MSQ', options: ['A', 'B', 'C', 'D'], correctAnswer: [0, 2] }],
      players: ids.map(userId => ({ userId, name: userId, score: 0, answered: false, connected: true })) });
    await mongo.getBattleRoomsCollection().insertOne(room);
    const instances = [], clients = [];
    const start = async () => { const server = createServer(), io = battleSocket.initBattleSocket(server); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); instances.push(io); return { server, io }; };
    const event = (client, name) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Restart timeout: ${name}`)), 5000); client.once(name, data => { clearTimeout(timer); resolve(data); }); });
    const connect = async (instance, index) => {
      const client = createSocketClient(`http://127.0.0.1:${instance.server.address().port}`, { transports: ['websocket'], auth: { token: tokens[index] }, reconnection: false, autoConnect: false });
      clients.push(client); const ready = event(client, 'connect'); client.connect(); await ready;
      const restored = event(client, 'battle:resumed'); client.emit('battle:resume', { code: room.code }); return { client, snapshot: await restored };
    };
    try {
      const first = await start(), second = await start();
      const a = await connect(first, 0), b = await connect(second, 1);
      const accepted = event(a.client, 'game:answerResult'); a.client.emit('game:answer', { code: room.code, questionIndex: 0, type: 'msq', selectedIndices: [0, 2] }); await accepted;
      await new Promise(resolve => first.io.close(resolve)); instances.splice(instances.indexOf(first.io), 1);
      const replacement = await start(), restored = await connect(replacement, 0);
      expect(restored.snapshot.myAnswer).toEqual({ type: 'msq', selectedIndices: [0, 2] });
      expect(restored.snapshot.reveal).toBeNull(); expect(restored.snapshot.scores[ids[0]].score).toBe(0);
      const revealed = event(restored.client, 'game:reveal'); b.client.emit('game:answer', { code: room.code, questionIndex: 0, type: 'msq', selectedIndices: [2, 0] }); await revealed;
      await mongo.getBattleRoomsCollection().updateOne({ code: room.code }, { $set: { questionAdvanceAt: new Date(Date.now() - 1) } });
      const endA = event(restored.client, 'game:end'), endB = event(b.client, 'game:end');
      const transition = await roomManager.advanceQuestion(room.code, 0);
      await (await import('../battleCompletion.js')).finishBattle(replacement.io, transition.room);
      for (const end of await Promise.all([endA, endB])) expect(end).toMatchObject({ winnerUserId: ids[0], outcomeReason: 'response-time' });
      const match = await mongo.getBattleMatchesCollection().findOne({ roomCode: room.code });
      expect(match.players.map(player => player.result)).toEqual(['win', 'loss']);
      expect(match.players[0].answerLog[0].answer).toEqual({ type: 'msq', selectedIndices: [0, 2] });
    } finally { clients.forEach(client => client.disconnect()); await Promise.all(instances.map(io => new Promise(resolve => io.close(resolve)))); }
  }, 20000);

  it('serializes Redis-free coordinators and fails a stale owner renewal', async () => {
    const { acquireMatchmakingPass } = await import('../matchmakingLock.js');
    const leases = await Promise.all(Array.from({ length: 20 }, () => acquireMatchmakingPass()));
    const winners = leases.filter(lease => lease.acquired); expect(winners).toHaveLength(1); expect(winners[0].degraded).toBe(true);
    await mongo.getMongoDB().collection('battleMatchmakingLocks').updateOne({ _id: 'pass' }, { $set: { owner: 'replacement' } });
    expect(await winners[0].renew()).toBe(false); await winners[0].release();
    expect(await mongo.getMongoDB().collection('battleMatchmakingLocks').findOne({ owner: 'replacement' })).not.toBeNull();
  });

  it.each([20, 100])('handles %i real players on two instances without answer or settlement duplication', async playerCount => {
    const began = performance.now(), prefix = `load-${playerCount}`, ids = Array.from({ length: playerCount }, (_, index) => `${prefix}-${index}`);
    await mongo.getUsersCollection().insertMany(ids.map(id => ({ id })));
    const tokens = await Promise.all(ids.map(async id => (await createSession({ id })).token));
    const rooms = Array.from({ length: playerCount / 2 }, (_, pair) => {
      const questionType = ['MCQ', 'MSQ', 'NAT'][pair % 3];
      return activeRoom({ code: `${prefix}-${pair}`, matchmakingId: `${prefix}-${pair}`, questionStartedAt: new Date(), questionDeadline: new Date(Date.now() + 120_000),
        questions: [{ question: 'Load fixture', questionType, options: questionType === 'NAT' ? [] : ['A','B','C','D'], correctAnswer: questionType === 'NAT' ? { min: 1.4, max: 1.6 } : questionType === 'MSQ' ? [0, 2] : 0 }],
        players: [0,1].map(offset => ({ userId: ids[pair * 2 + offset], name: 'Load player', score: 0, answered: false, connected: true })) });
    });
    await mongo.getBattleRoomsCollection().insertMany(rooms);
    const servers = [createServer(), createServer()], ios = servers.map(server => battleSocket.initBattleSocket(server));
    await Promise.all(servers.map(server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))));
    const clients = tokens.map((token, index) => createSocketClient(`http://127.0.0.1:${servers[index % 2].address().port}`, { transports: ['websocket'], auth: { token }, reconnection: false, autoConnect: false }));
    const event = (client, name) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { client.off(name, done); reject(new Error(`Load timeout: ${name}`)); }, 20000);
      const done = data => { clearTimeout(timer); resolve(data); }; client.once(name, done);
    });
    const sendAnswer = index => {
      const room = rooms[Math.floor(index / 2)], kind = room.questions[0].questionType;
      clients[index].emit('game:answer', { code: room.code.toUpperCase(), questionIndex: 0, ...(kind === 'NAT' ? { type: 'nat', numericAnswer: 1.5 } : kind === 'MSQ' ? { type: 'msq', selectedIndices: [2, 0] } : { type: 'mcq', selectedIndex: 0 }) });
    };
    // Public codes use the same validated alphabet as production.
    const { generateBattleCode } = await import('../battleProtocol.js');
    for (const room of rooms) { const old = room.code; room.code = generateBattleCode(); await mongo.getBattleRoomsCollection().updateOne({ code: old }, { $set: { code: room.code } }); }
    try {
      const connections = clients.map(client => event(client, 'connect')); clients.forEach(client => client.connect()); await Promise.all(connections);
      await Promise.all(clients.map(async (client, index) => { const ready = event(client, 'battle:resumed'); client.emit('battle:resume', { code: rooms[Math.floor(index / 2)].code }); await ready; }));
      const first = clients.map((client, index) => index % 2 === 0 ? event(client, 'game:answerResult') : null).filter(Boolean);
      clients.forEach((_client, index) => { if (index % 2 === 0) sendAnswer(index); });
      expect((await Promise.all(first)).every(result => result.accepted === true)).toBe(true);
      const snapshots = await Promise.all(clients.map(async (client, index) => {
        const resumed = event(client, 'battle:resumed'); client.emit('battle:resume', { code: rooms[Math.floor(index / 2)].code }); return resumed;
      }));
      expect(snapshots.every(snapshot => !snapshot.reveal && Object.values(snapshot.scores).every(player => player.score === 0 && player.lastCorrect === undefined))).toBe(true);
      const reveals = clients.map(client => event(client, 'game:reveal')), answeredAt = performance.now();
      clients.forEach((_client, index) => { if (index % 2 === 1) sendAnswer(index); });
      expect((await Promise.all(reveals)).every(reveal => Object.values(reveal.results).every(result => result.correct && result.points === 10))).toBe(true);
      const revealMs = Math.round(performance.now() - answeredAt);
      // Replaying the persisted answer path still cannot increment scores.
      const stored = await mongo.getBattleRoomsCollection().find({ code: { $in: rooms.map(room => room.code) } }).toArray();
      expect(stored.every(room => room.players.every(player => player.score === 10 && player.answerLog.length === 1))).toBe(true);
      await mongo.getBattleRoomsCollection().updateMany({ code: { $in: rooms.map(room => room.code) } }, { $set: { questionAdvanceAt: new Date(Date.now() - 1) } });
      for (let offset = 0; offset < rooms.length; offset += 4) await Promise.all(rooms.slice(offset, offset + 4).map(async room => {
        const transition = await roomManager.advanceQuestion(room.code, 0); expect(transition.finished).toBe(true);
        await Promise.all([resultService.settleBattleResult(transition.room), resultService.settleBattleResult(transition.room)]);
      }));
      expect(await mongo.getBattleMatchesCollection().countDocuments({ roomCode: { $in: rooms.map(room => room.code) } })).toBe(playerCount / 2);
      const profiles = await mongo.getBattleProfilesCollection().find({ userId: { $in: ids } }).toArray();
      expect(profiles).toHaveLength(playerCount); expect(profiles.every(profile => profile.gamesPlayed === 1)).toBe(true);
      process.stdout.write(`LOCAL_BATTLE_LOAD ${JSON.stringify({ players: playerCount, instances: 2, rounds: rooms.length, revealBurstMs: revealMs, totalMs: Math.round(performance.now() - began), duplicateScores: 0, duplicateSettlements: 0 })}\n`);
    } finally { clients.forEach(client => client.disconnect()); await Promise.all(ios.map(io => new Promise(resolve => io.close(resolve)))); }
  }, 120000);

  it('inspects deployed index definitions without writes and identifies a missing index', async () => {
    const { inspectBattleReadiness } = await import('../battleReadiness.js');
    const db = mongo.getMongoDB(); expect((await inspectBattleReadiness(db)).passed).toBe(true);
    await db.collection('battleMatchmakingLocks').dropIndex('battle_matchmaking_lease_ttl');
    const missing = await inspectBattleReadiness(db); expect(missing.passed).toBe(false);
    expect(missing.missingIndexes.some(index => index.collection === 'battleMatchmakingLocks')).toBe(true);
    await (await import('../../migrations/020-battle-coordinator.js')).up(db);
  });

  it("answer versus timeout leaves exactly one answer log per player", async () => {
    const room = activeRoom();
    await mongo.getBattleRoomsCollection().insertOne(room);
    const atDeadline = new Date(room.questionDeadline);

    await Promise.allSettled([
      roomManager.submitAnswer({ code: room.code, userId: "user-a", questionIndex: 0, selectedIndex: 0, now: atDeadline }),
      roomManager.resolveExpiredQuestion(room.code, 0, atDeadline),
    ]);

    const stored = await mongo.getBattleRoomsCollection().findOne({ code: room.code });
    expect(stored.players.every((player) => player.answered)).toBe(true);
    expect(stored.players.map((player) => player.answerLog)).toSatisfy(
      (logs) => logs.every((entries) => entries.length === 1)
    );
  });

  it("concurrent settlement records one match and increments each profile once", async () => {
    const room = activeRoom({
      status: "finished", finishReason: "completed", finishedAt: new Date(),
      players: [
        { userId: "user-a", name: "A", score: 10, answered: true, answerLog: [] },
        { userId: "user-b", name: "B", score: 0, answered: true, answerLog: [] },
      ],
    });
    await mongo.getBattleRoomsCollection().insertOne(room);

    const outcomes = await Promise.allSettled([
      resultService.settleBattleResult(room),
      resultService.settleBattleResult(room),
    ]);

    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(await mongo.getBattleMatchesCollection().countDocuments({ roomCode: room.code })).toBe(1);
    const profiles = await mongo.getBattleProfilesCollection().find({ userId: { $in: ["user-a", "user-b"] } }).toArray();
    expect(profiles).toHaveLength(2);
    expect(profiles.every((profile) => profile.gamesPlayed === 1)).toBe(true);
  });

  it("reconnect versus forfeit produces one coherent durable outcome", async () => {
    const expired = new Date(Date.now() - 1_000);
    const room = activeRoom({
      questionDeadline: new Date(Date.now() + 60_000),
      players: [
        { userId: "user-a", name: "A", socketId: "old-a", score: 0, answered: false, connected: false, reconnectDeadline: expired },
        { userId: "user-b", name: "B", socketId: "socket-b", score: 0, answered: false, connected: true },
      ],
    });
    await mongo.getBattleRoomsCollection().insertOne(room);

    await Promise.allSettled([
      presenceWorker.runBattlePresenceWorkerOnce(),
      roomManager.resumePlayerConnection({ code: room.code, userId: "user-a", socketId: "new-a" }),
    ]);

    const stored = await mongo.getBattleRoomsCollection().findOne({ code: room.code });
    if (stored.status === "finished") {
      expect(stored.finishReason).toBe("forfeit");
      expect(stored.winnerUserId).toBe("user-b");
      expect(await mongo.getBattleMatchesCollection().countDocuments({ roomCode: room.code })).toBe(1);
    } else {
      expect(stored.status).toBe("active");
      expect(stored.players.find((player) => player.userId === "user-a")).toMatchObject({
        socketId: "new-a", connected: true,
      });
    }
  });

  it("concurrent matchmaking passes claim each ticket at most once", async () => {
    await Promise.all(['user-a', 'user-b'].map(userId => matchmakingService.joinMatchmakingQueue({ userId, displayName: userId, subject: 'mathematics', topic: 'all', questionCount: 10 })));

    await Promise.all([matchmakingService.runMatchmakingPass(), matchmakingService.runMatchmakingPass()]);

    expect(await mongo.getBattleRoomsCollection().countDocuments({ matchmakingId: { $exists: true } })).toBe(1);
    const tickets = await mongo.getBattleMatchmakingQueueCollection().find({}).toArray();
    expect(tickets.every((ticket) => ticket.status === "matched")).toBe(true);
    expect(new Set(tickets.map((ticket) => ticket.matchmakingId)).size).toBe(1);
  });

  it("mission progress and mission claims remain single-award under concurrency", async () => {
    const match = {
      roomCode: "mission-room", matchmakingId: "ranked", seasonKey: "s1", rated: true,
      finishReason: "completed", finishedAt: new Date(),
      players: [{ userId: "user-a", result: "win", answerLog: [{ correct: true }] }],
    };
    await Promise.all([
      progressionService.processBattleMissionProgress(match),
      progressionService.processBattleMissionProgress(match),
    ]);
    expect(await mongo.getBattleProgressEventsCollection().countDocuments({ roomCode: match.roomCode })).toBe(1);

    const mission = await mongo.getBattleMissionProgressCollection().findOne({ userId: "user-a", missionCode: "daily-win-1" });
    const claims = await Promise.allSettled([
      progressionService.claimBattleMission({ userId: "user-a", missionProgressId: String(mission._id) }),
      progressionService.claimBattleMission({ userId: "user-a", missionProgressId: String(mission._id) }),
    ]);
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(1);
    expect((await mongo.getBattleProgressionProfilesCollection().findOne({ userId: "user-a" })).totalXp).toBe(100);
  });

  it("season rewards can only be claimed once", async () => {
    const now = new Date();
    await mongo.getBattleSeasonsCollection().insertOne({
      key: "s1", name: "Season 1", status: "active",
      startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 60_000),
      rewardTrack: [{ level: 2, reward: { cosmeticCode: "title-challenger" } }],
    });
    await mongo.getBattleSeasonProgressCollection().insertOne({ seasonKey: "s1", userId: "user-a", level: 2, xp: 500 });

    const claims = await Promise.allSettled([
      rewardService.claimBattleSeasonReward({ userId: "user-a", seasonKey: "s1", milestoneLevel: 2 }),
      rewardService.claimBattleSeasonReward({ userId: "user-a", seasonKey: "s1", milestoneLevel: 2 }),
    ]);

    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(1);
    expect(await mongo.getBattleSeasonRewardClaimsCollection().countDocuments({ userId: "user-a" })).toBe(1);
    expect(await mongo.getBattleCosmeticInventoryCollection().countDocuments({ userId: "user-a" })).toBe(1);
  });

  it("season rollover is idempotent", async () => {
    const now = new Date();
    await mongo.getBattleSeasonsCollection().insertMany([
      { key: "old", name: "Old", status: "active", startsAt: new Date(now - 120_000), endsAt: new Date(now - 60_000) },
      { key: "new", name: "New", status: "scheduled", startsAt: new Date(now - 30_000), endsAt: new Date(now.getTime() + 60_000) },
    ]);
    await seasonWorker.runBattleSeasonWorkerOnce();
    await seasonWorker.runBattleSeasonWorkerOnce();

    expect((await mongo.getBattleSeasonsCollection().findOne({ key: "old" })).status).toBe("completed");
    expect((await mongo.getBattleSeasonsCollection().findOne({ key: "new" })).status).toBe("active");
    expect(await mongo.getBattleSeasonRewardsCollection().countDocuments({ seasonKey: "old" })).toBe(0);
  });

  it('recovers crashed/legacy finalization while leaving a live lease untouched', async () => {
    const now = new Date();
    await mongo.getBattleSeasonsCollection().insertMany([
      { key: 'expired', status: 'finalizing', endsAt: new Date(now - 1000), finalizationOwner: 'crashed', finalizationLeaseUntil: new Date(now - 1000) },
      { key: 'legacy', status: 'finalizing', endsAt: new Date(now - 1000), finalizingAt: new Date(now - 180000) },
      { key: 'busy', status: 'finalizing', endsAt: new Date(now - 1000), finalizationOwner: 'live', finalizationLeaseUntil: new Date(now.getTime() + 120000) },
    ]);
    await mongo.getBattleSeasonProfilesCollection().insertMany(['expired', 'legacy', 'busy'].flatMap(seasonKey => ['a', 'b'].map(userId => ({ seasonKey, userId, rating: 1200, wins: 3, gamesPlayed: 5, tier: 'Silver' }))));
    await seasonWorker.runBattleSeasonWorkerOnce();
    await seasonWorker.runBattleSeasonWorkerOnce();
    for (const key of ['expired', 'legacy']) {
      expect((await mongo.getBattleSeasonsCollection().findOne({ key })).status).toBe('completed');
      const rewards = await mongo.getBattleSeasonRewardsCollection().find({ seasonKey: key }).sort({ finalRank: 1 }).toArray();
      expect(rewards.map(row => [row.userId, row.finalRank])).toEqual([['a', 1], ['b', 2]]);
    }
    expect((await mongo.getBattleSeasonsCollection().findOne({ key: 'busy' })).finalizationOwner).toBe('live');
    expect(await mongo.getBattleSeasonRewardsCollection().countDocuments({ seasonKey: 'busy' })).toBe(0);
  });

  it('rolls back rewards when another worker replaces the finalization owner', async () => {
    const db = mongo.getMongoDB(), now = new Date();
    const seasons = mongo.getBattleSeasonsCollection(), rewards = mongo.getBattleSeasonRewardsCollection();
    await seasons.insertOne({ key: 'fenced', status: 'active', endsAt: new Date(now - 1000) });
    await mongo.getBattleSeasonProfilesCollection().insertOne({ seasonKey: 'fenced', userId: 'a', rating: 1200, wins: 3, gamesPlayed: 5, tier: 'Silver' });
    const originalCollection = db.collection.bind(db), originalWrite = rewards.bulkWrite.bind(rewards);
    const lookup = vi.spyOn(db, 'collection').mockImplementation(name => name === 'battleSeasonRewards' ? rewards : originalCollection(name));
    const write = vi.spyOn(rewards, 'bulkWrite').mockImplementationOnce(async (...args) => {
      const result = await originalWrite(...args);
      // Simulate a lease recovery on another instance before the old commit.
      await seasons.updateOne({ key: 'fenced' }, { $set: { finalizationOwner: 'replacement', finalizationLeaseUntil: new Date(Date.now() + 120000) } });
      return result;
    });
    try { await expect(seasonWorker.runBattleSeasonWorkerOnce()).rejects.toThrow('lease lost'); }
    finally { write.mockRestore(); lookup.mockRestore(); }
    expect(await rewards.countDocuments({ seasonKey: 'fenced' })).toBe(0);
    expect((await seasons.findOne({ key: 'fenced' })).finalizationOwner).toBe('replacement');
    await seasons.updateOne({ key: 'fenced' }, { $set: { finalizationLeaseUntil: new Date(Date.now() - 1000) } });
    await seasonWorker.runBattleSeasonWorkerOnce();
    expect(await rewards.countDocuments({ seasonKey: 'fenced' })).toBe(1);
    expect((await seasons.findOne({ key: 'fenced' })).status).toBe('completed');
  });

  it("delivers a user-room event across two Socket.IO instances", async () => {
    await mongo.getUsersCollection().insertMany([{ id: 'user-a' }, { id: 'user-b' }]);
    const tokenA = (await createSession({ id: 'user-a' })).token;
    const tokenB = (await createSession({ id: 'user-b' })).token;
    const serverA = createServer();
    const serverB = createServer();
    const ioA = battleSocket.initBattleSocket(serverA);
    const ioB = battleSocket.initBattleSocket(serverB);
    await Promise.all([
      new Promise((resolve) => serverA.listen(0, "127.0.0.1", resolve)),
      new Promise((resolve) => serverB.listen(0, "127.0.0.1", resolve)),
    ]);
    const clientA = createSocketClient(`http://127.0.0.1:${serverA.address().port}`, {
      transports: ["websocket"], auth: { token: tokenA },
    });
    const clientB = createSocketClient(`http://127.0.0.1:${serverB.address().port}`, {
      transports: ["websocket"], auth: { token: tokenB },
    });
    try {
      await Promise.all([
        new Promise((resolve, reject) => { clientA.once("connect", resolve); clientA.once("connect_error", reject); }),
        new Promise((resolve, reject) => { clientB.once("connect", resolve); clientB.once("connect_error", reject); }),
      ]);
      const received = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("cross-instance event timed out")), 5_000);
        clientB.once("battle:test", (payload) => { clearTimeout(timeout); resolve(payload); });
      });
      ioA.to("user:user-b").emit("battle:test", { ok: true });
      await expect(received).resolves.toEqual({ ok: true });
    } finally {
      clientA.close();
      clientB.close();
      await Promise.all([
        new Promise((resolve) => ioA.close(resolve)),
        new Promise((resolve) => ioB.close(resolve)),
      ]);
    }
  }, 15_000);
});
