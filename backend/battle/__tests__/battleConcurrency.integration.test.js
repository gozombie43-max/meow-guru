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
    const queuedAt = new Date();
    await mongo.getBattleMatchmakingQueueCollection().insertMany([
      { userId: "user-a", displayName: "A", rating: 1200, subject: "mathematics", topic: "all", questionCount: 10, status: "waiting", queuedAt },
      { userId: "user-b", displayName: "B", rating: 1210, subject: "mathematics", topic: "all", questionCount: 10, status: "waiting", queuedAt },
    ]);

    await Promise.all([matchmakingService.runMatchmakingPass(), matchmakingService.runMatchmakingPass()]);

    expect(await mongo.getBattleRoomsCollection().countDocuments({ matchmakingId: { $exists: true } })).toBe(1);
    const tickets = await mongo.getBattleMatchmakingQueueCollection().find({}).toArray();
    expect(tickets.every((ticket) => ticket.status === "matched")).toBe(true);
    expect(new Set(tickets.map((ticket) => ticket.matchmakingId)).size).toBe(1);
  });

  it("mission progress and mission claims remain single-award under concurrency", async () => {
    const match = {
      roomCode: "mission-room", matchmakingId: "ranked", seasonKey: "s1",
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
