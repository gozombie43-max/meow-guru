import { randomUUID } from "node:crypto";
import {
  getBattleRoomsCollection,
  withMongoTransaction,
  getMongoDB,
} from "../config/mongodb.js";
import { getActiveBattleSeason } from "./battleSeasonService.js";
import { generateBattleCode, publicBattleScores, isRoundClosed } from './battleProtocol.js';
import { battlePolicy } from './battlePolicy.js';
import { battleAnswerKey, battleQuestionType, normalizeBattleAnswer, gradeBattleAnswer, publicBattleQuestion, storedBattleAnswer } from './battleAnswers.js';
import { battleDecision } from './battleOutcome.js';
import { claimBattleLease, releaseBattleLeases, allowBattleAction, BattleBusyError, battleFailureMessage } from './battleLifecycle.js';

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const BATTLE_RECONNECT_GRACE_MS = Number(process.env.BATTLE_RECONNECT_GRACE_MS) || 60_000;
const BATTLE_DEPLOYMENT_GRACE_MS = Number(process.env.BATTLE_DEPLOYMENT_GRACE_MS) || 180_000;
const QUESTION_TIME_MS = Number(process.env.BATTLE_QUESTION_TIME_MS) || 86_400_000;
const QUESTION_REVEAL_MS = Number(process.env.BATTLE_QUESTION_REVEAL_MS) || 5_000;

function createQuestionWindow(now = new Date(), room = {}) {
  const type = battleQuestionType(room.questions?.[room.currentIndex || 0]);
  const configured = Number(process.env[`BATTLE_RANKED_${type.toUpperCase()}_TIME_MS`] || process.env.BATTLE_RANKED_QUESTION_TIME_MS);
  const duration = room.mode === 'ranked' ? Math.max(5_000, Math.min(120_000, configured || (type === 'mcq' ? 20_000 : 30_000))) : QUESTION_TIME_MS;
  return { questionStartedAt: now, questionDeadline: new Date(now.getTime() + duration) };
}

// Question documents historically store the key in more than one form: an
// option index, an A-D letter, or the option text itself.  Battles must use a
// single index internally, otherwise a perfectly valid selected option is
// rejected as an "invalid answer key".
export function getCorrectAnswerIndex(question) {
  const key = battleAnswerKey(question || {});
  return key?.type === 'mcq' ? key.selectedIndex : null;
}

function expiryFromNow(room = {}) {
  const deadline = room.questionDeadline ? +new Date(room.questionDeadline) : 0;
  return new Date(Math.max(Date.now() + ROOM_TTL_MS, deadline + 300_000));
}

const generateCode = generateBattleCode;

function cleanRoom(room) {
  if (!room) return null;
  const { _id, ...clean } = room;
  return clean;
}

const scoresFromRoom = publicBattleScores;

export async function createRoom(socketId, playerName, subject, topic, questionCount, ownerUserId, options = {}) {
  const rooms = getBattleRoomsCollection();
  const normalizedOwnerUserId = String(ownerUserId);
  if (!await allowBattleAction(normalizedOwnerUserId, 'create', 1, 10_000)) throw Object.assign(new Error('Please wait before creating another room.'), { code: 'BATTLE_RATE_LIMIT' });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = generateCode();
    const now = new Date();
    const activeSeason = await getActiveBattleSeason(now);
    try {
      await withMongoTransaction(async ({ session }) => {
        await claimBattleLease({ userId: normalizedOwnerUserId, kind: 'room', resourceId: code, expiresAt: expiryFromNow(), session });
        await rooms.insertOne({
        code,
        ...battlePolicy(options.origin === 'social' || options.origin === 'rematch' ? options.origin : 'private'),
        allowedOpponentUserId: options.allowedOpponentUserId ? String(options.allowedOpponentUserId) : null,
        seasonKey: activeSeason?.key || null,
        ownerUserId: normalizedOwnerUserId,
        subject: subject || "mathematics",
        topic: topic || "all",
        questionCount: Number(questionCount) || 10,
        questions: [],
        currentIndex: 0,
        players: [{
          userId: normalizedOwnerUserId,
          socketId,
          name: String(playerName || "Player").slice(0, 40),
          score: 0,
          answered: false,
          connected: true,
          joinedAt: now,
        }],
        status: "waiting",
        createdAt: now,
        updatedAt: now,
        expiresAt: expiryFromNow(),
        }, { session });
      });
      return code;
    } catch (error) {
      if (error?.code === 11000 && (error.keyPattern?._id || error.keyPattern?.userId)) throw new BattleBusyError();
      if (error?.code === 11000) continue;
      throw error;
    }
  }

  throw new Error("Could not allocate battle room code");
}

export async function getRoom(code) {
  return cleanRoom(await getBattleRoomsCollection().findOne({ code: String(code) }));
}

export async function joinRoom(code, socketId, playerName, userId) {
  const rooms = getBattleRoomsCollection();
  const normalizedCode = String(code);
  const normalizedUserId = String(userId);
  const now = new Date();
  const existing = await rooms.findOne({
    code: normalizedCode,
    "players.userId": normalizedUserId,
    status: { $in: ['waiting', 'active'] }, expiresAt: { $gt: now },
  });

  if (existing) {
    const rebound = await rooms.findOneAndUpdate(
      { code: normalizedCode },
      {
        $set: {
          "players.$[player].socketId": socketId,
          "players.$[player].connected": true,
          "players.$[player].disconnectedAt": null,
          updatedAt: now,
          expiresAt: existing.status === 'waiting' && existing.origin === 'matchmaking' ? existing.expiresAt : expiryFromNow(existing),
        },
      },
      {
        arrayFilters: [{ "player.userId": normalizedUserId }],
        returnDocument: "after",
      }
    );
    return { room: cleanRoom(rebound), resumed: true };
  }

  if (!await allowBattleAction(normalizedUserId, 'join', 10, 60_000)) return { error: 'Too many join attempts. Please wait a minute.' };
  let result;
  try { result = await withMongoTransaction(async ({ session }) => {
    const target = await rooms.findOne({ code: normalizedCode, status: 'waiting', expiresAt: { $gt: now } }, { session });
    if (!target) return null;
    if (target.allowedOpponentUserId && target.allowedOpponentUserId !== normalizedUserId) throw Object.assign(new Error('This invitation is reserved for another player.'), { code: 'BATTLE_INVITATION' });
    await claimBattleLease({ userId: normalizedUserId, kind: 'room', resourceId: normalizedCode, expiresAt: expiryFromNow(), session });
    const joined = await rooms.findOneAndUpdate(
    {
      code: normalizedCode,
      status: "waiting",
      expiresAt: { $gt: now },
      "players.userId": { $ne: normalizedUserId },
      $expr: { $lt: [{ $size: "$players" }, 2] },
    },
    {
      $push: {
        players: {
          userId: normalizedUserId,
          socketId,
          name: String(playerName || "Player").slice(0, 40),
          score: 0,
          answered: false,
          connected: true,
          joinedAt: now,
        },
      },
      $set: { updatedAt: now, expiresAt: expiryFromNow() },
    },
    { returnDocument: "after", session }
    );
    if (!joined) throw new Error('Room is no longer available.');
    return joined;
  }); } catch (error) { return { error: error?.code === 11000 ? new BattleBusyError().message : battleFailureMessage(error, 'Could not join this room. Please try again.') }; }

  if (result) return { room: cleanRoom(result) };

  const room = await getRoom(normalizedCode);
  if (!room) return { error: "Room not found" };
  return { error: room.status !== "waiting" ? "Game already started" : "Room is full" };
}

export async function deleteRoom(code) {
  await withMongoTransaction(async ({ session }) => {
    const result = await getBattleRoomsCollection().deleteOne({ code: String(code), status: 'waiting' }, { session });
    if (result.deletedCount) await releaseBattleLeases('room', String(code), { session });
  });
}

export async function reserveRoomOpponent(code, ownerUserId, opponentUserId) {
  return getBattleRoomsCollection().findOneAndUpdate({ code: String(code), ownerUserId: String(ownerUserId), status: 'waiting',
    expiresAt: { $gt: new Date() }, $expr: { $eq: [{ $size: '$players' }, 1] },
    $or: [{ allowedOpponentUserId: null }, { allowedOpponentUserId: String(opponentUserId) }],
  }, { $set: { allowedOpponentUserId: String(opponentUserId), updatedAt: new Date() } }, { returnDocument: 'after' });
}

export async function setQuestions(code, questions, selection = {}) {
  const now = new Date();
  const waiting = await getRoom(code);
  if (!waiting) return null;
  const timing = createQuestionWindow(now, { ...waiting, questions, currentIndex: 0 });
  return withMongoTransaction(async ({ session }) => {
  const room = await getBattleRoomsCollection().findOneAndUpdate(
    { code: String(code), status: "waiting", expiresAt: { $gt: now }, ...(waiting.origin === 'matchmaking' ? { 'players.connected': { $ne: false } } : {}) },
    {
      $set: {
        questions,
        ...selection,
        currentIndex: 0,
        status: "active",
        realtimeVersion: randomUUID(),
        questionStartedAt: timing.questionStartedAt,
        questionDeadline: timing.questionDeadline,
        updatedAt: now,
        expiresAt: expiryFromNow(timing),
      },
    },
    { returnDocument: "after", session }
  );
  if (room) {
    const db = getMongoDB();
    await db.collection('battleUserLeases').updateMany({ kind: 'room', resourceId: String(code) }, { $set: { expiresAt: room.expiresAt } }, { session });
    if (room.mode === 'ranked') {
      const writes = room.players.flatMap(player => questions.map(question => {
        const questionUid = String(question.questionUid || question._id || question.id);
        return { updateOne: { filter: { roomCode: String(code), userId: player.userId, questionUid },
          update: { $setOnInsert: { roomCode: String(code), userId: player.userId, questionUid, playedAt: now } }, upsert: true } };
      }));
      if (writes.length) await db.collection('battleQuestionHistory').bulkWrite(writes, { session });
    }
  }
  return cleanRoom(room);
  });
}

export async function getCurrentQuestion(code) {
  const room = await getRoom(code);
  return room?.questions?.[room.currentIndex] || null;
}

export function buildPublicQuestion(room) {
  if (!room || room.status !== "active") return null;
  const question = room.questions?.[room.currentIndex];
  if (!question) return null;
  return { ...publicBattleQuestion(question), questionIndex: room.currentIndex, total: room.questions.length, deadline: room.questionDeadline || null };
}

export async function getScores(code) {
  return scoresFromRoom(await getRoom(code));
}

export async function submitAnswer({ code, userId, questionIndex, now = new Date(), ...input }) {
  const rooms = getBattleRoomsCollection();
  const normalizedCode = String(code);
  const normalizedUserId = String(userId);
  const room = await rooms.findOne({ code: normalizedCode, status: "active", "players.userId": normalizedUserId });
  if (!room) return { ok: false, reason: "room-not-active" };
  if (room.currentIndex !== questionIndex) return { ok: false, reason: "stale-question" };

  const question = room.questions?.[room.currentIndex];
  const player = room.players.find((item) => item.userId === normalizedUserId);
  if (!question) return { ok: false, reason: "invalid-question" };
  if (!player || player.answered) return { ok: false, reason: "already-answered" };
  const answer = normalizeBattleAnswer(question, input);
  if (!answer) return { ok: false, reason: "invalid-option" };
  if (room.questionDeadline && now.getTime() > new Date(room.questionDeadline).getTime()) return { ok: false, reason: "deadline-expired" };

  const grade = gradeBattleAnswer(question, answer);
  if (!grade) return { ok: false, reason: "invalid-answer-key" };
  const isCorrect = grade.correct, selectedIndex = answer.selectedIndex ?? null;
  const responseTimeMs = room.questionStartedAt ? Math.max(0, now.getTime() - new Date(room.questionStartedAt).getTime()) : null;
  const result = await rooms.updateOne(
    {
      code: normalizedCode,
      status: "active",
      currentIndex: questionIndex,
      questionDeadline: { $gte: now },
      players: { $elemMatch: { userId: normalizedUserId, answered: false } },
    },
    {
      $set: {
        "players.$[player].answered": true,
        "players.$[player].selectedIndex": selectedIndex,
        "players.$[player].answer": answer,
        "players.$[player].roundPoints": grade.points,
        "players.$[player].lastCorrect": isCorrect,
        "players.$[player].answeredAt": now,
        "players.$[player].responseTimeMs": responseTimeMs,
        updatedAt: now,
        expiresAt: expiryFromNow(room),
      },
      $push: {
        "players.$[player].answerLog": {
          questionIndex,
          selectedIndex,
          answer,
          points: grade.points,
          correct: isCorrect,
          responseTimeMs,
          timedOut: false,
          answeredAt: now,
        },
      },
      ...(grade.points ? { $inc: { "players.$[player].score": grade.points } } : {}),
    },
    { arrayFilters: [{ "player.userId": normalizedUserId, "player.answered": false }] }
  );

  if (result.modifiedCount !== 1) return { ok: false, reason: "already-answered" };

  const updated = await getRoom(normalizedCode);
  const allAnswered = updated.players.length === 2 && updated.players.every((item) => item.answered);
  const revealed = allAnswered ? await claimBattleReveal(normalizedCode, questionIndex, now) : null;
  return {
    ok: true, isCorrect,
    allAnswered,
    questionIndex, correctIndex: allAnswered ? getCorrectAnswerIndex(question) : null,
    scores: scoresFromRoom(updated),
    reveal: revealed ? buildBattleReveal(revealed) : null,
  };
}

export function buildBattleReveal(room) {
  const question = room?.questions?.[room.currentIndex];
  if (!question || !isRoundClosed(room)) return null;
  return { questionIndex: room.currentIndex, correctIndex: getCorrectAnswerIndex(question),
    correctAnswer: battleAnswerKey(question),
    answers: Object.fromEntries(room.players.map(player => [player.userId, storedBattleAnswer(player)])),
    results: Object.fromEntries(room.players.map(player => [player.userId, { correct: Boolean(player.lastCorrect), points: player.roundPoints ?? (player.lastCorrect ? 10 : 0) }])),
    selections: Object.fromEntries(room.players.map(player => [player.userId, player.selectedIndex ?? null])),
    scores: publicBattleScores(room), revealEndsAt: room.questionAdvanceAt || null };
}

export async function claimBattleReveal(code, questionIndex, now = new Date()) {
  return cleanRoom(await getBattleRoomsCollection().findOneAndUpdate({ code, status: 'active', currentIndex: questionIndex,
    questionAdvanceAt: { $exists: false }, players: { $not: { $elemMatch: { answered: { $ne: true } } } },
    $expr: { $eq: [{ $size: '$players' }, 2] },
  }, { $set: { questionResolvedAt: now, questionResolutionIndex: questionIndex,
    questionAdvanceAt: new Date(now.getTime() + QUESTION_REVEAL_MS), realtimeVersion: randomUUID(), updatedAt: now } }, { returnDocument: 'after' }));
}

export async function resolveExpiredQuestion(code, expectedIndex, now = new Date()) {
  const rooms = getBattleRoomsCollection();
  const normalizedCode = String(code);
  const room = await rooms.findOne({
    code: normalizedCode,
    status: "active",
    currentIndex: expectedIndex,
    questionDeadline: { $lte: now },
  });
  if (!room) return { resolved: false, room: null };

  const unanswered = room.players.filter((player) => !player.answered);
  if (unanswered.length) {
    const responseTimeMs = room.questionStartedAt
      ? Math.max(0, new Date(room.questionDeadline).getTime() - new Date(room.questionStartedAt).getTime())
      : null;
    await rooms.updateOne(
      {
        code: normalizedCode,
        status: "active",
        currentIndex: expectedIndex,
        questionDeadline: { $lte: now },
        players: { $elemMatch: { answered: false } },
      },
      {
        $set: {
          "players.$[player].answered": true,
          "players.$[player].selectedIndex": null,
          "players.$[player].answer": null,
          "players.$[player].roundPoints": 0,
          "players.$[player].lastCorrect": false,
          "players.$[player].answeredAt": now,
          "players.$[player].responseTimeMs": responseTimeMs,
          questionResolvedAt: now,
          realtimeVersion: randomUUID(),
          questionResolutionIndex: expectedIndex,
          questionAdvanceAt: new Date(now.getTime() + QUESTION_REVEAL_MS),
          updatedAt: now,
          expiresAt: expiryFromNow(room),
        },
        $push: {
          "players.$[player].answerLog": {
            questionIndex: expectedIndex,
            selectedIndex: null,
            answer: null,
            points: 0,
            correct: false,
            responseTimeMs,
            timedOut: true,
            answeredAt: now,
          },
        },
      },
      { arrayFilters: [{ "player.answered": false }] }
    );
  }

  let latest = await getRoom(normalizedCode);
  if (!latest || latest.status !== "active" || latest.currentIndex !== expectedIndex) {
    return { resolved: false, room: latest };
  }

  if (latest.players.every((player) => player.answered) && !latest.questionAdvanceAt) {
    const claimed = await rooms.findOneAndUpdate(
      {
        code: normalizedCode,
        status: "active",
        currentIndex: expectedIndex,
        questionDeadline: { $lte: now },
        questionAdvanceAt: { $exists: false },
      },
      {
        $set: {
          questionResolvedAt: now,
          realtimeVersion: randomUUID(),
          questionResolutionIndex: expectedIndex,
          questionAdvanceAt: new Date(now.getTime() + QUESTION_REVEAL_MS),
          updatedAt: now,
        },
      },
      { returnDocument: "after" }
    );
    if (claimed) latest = cleanRoom(claimed);
  }

  return {
    resolved: latest.players.every((player) => player.answered),
    room: latest,
    readyToAdvance: Boolean(
      latest.questionAdvanceAt && new Date(latest.questionAdvanceAt) <= now
    ),
  };
}

export async function advanceQuestion(code, expectedIndex) {
  const rooms = getBattleRoomsCollection();
  const normalizedCode = String(code);
  const room = await rooms.findOne({
    code: normalizedCode,
    status: "active",
    currentIndex: expectedIndex,
  });
  if (!room || !room.players.every((player) => player.answered)) {
    return { advanced: false };
  }
  if (room.questionAdvanceAt && new Date(room.questionAdvanceAt) > new Date()) return { advanced: false };

  const now = new Date();
  if (expectedIndex + 1 >= room.questions.length) {
    const result = await rooms.findOneAndUpdate(
      { code: normalizedCode, status: "active", currentIndex: expectedIndex },
      {
        $set: {
          status: "finished",
          realtimeVersion: randomUUID(),
          finishReason: "completed",
          ...battleDecision(room),
          finishedAt: now,
          updatedAt: now,
          expiresAt: expiryFromNow(),
        },
      },
      { returnDocument: "after" }
    );
    return { advanced: Boolean(result), finished: Boolean(result), room: cleanRoom(result) };
  }

  const timing = createQuestionWindow(now, { ...room, currentIndex: expectedIndex + 1 });
  const updated = await rooms.findOneAndUpdate(
    { code: normalizedCode, status: "active", currentIndex: expectedIndex },
    {
      $set: {
        currentIndex: expectedIndex + 1,
        "players.$[].answered": false,
        realtimeVersion: randomUUID(),
        questionStartedAt: timing.questionStartedAt,
        questionDeadline: timing.questionDeadline,
        updatedAt: now,
        expiresAt: expiryFromNow(timing),
      },
      $unset: {
        "players.$[].selectedIndex": "",
        "players.$[].answer": "",
        "players.$[].roundPoints": "",
        "players.$[].lastCorrect": "",
        "players.$[].answeredAt": "",
        "players.$[].responseTimeMs": "",
        questionResolvedAt: "",
        questionResolutionIndex: "",
        questionAdvanceAt: "",
      },
    },
    { returnDocument: "after" }
  );
  return { advanced: Boolean(updated), finished: false, room: cleanRoom(updated) };
}

export async function markSocketDisconnected(socketId, { deployment = false } = {}) {
  const rooms = getBattleRoomsCollection();
  const room = await rooms.findOne({
    "players.socketId": socketId,
    status: { $in: ["waiting", "active"] },
  });
  if (!room) return null;

  const now = new Date();
  const graceMs = deployment ? BATTLE_DEPLOYMENT_GRACE_MS : BATTLE_RECONNECT_GRACE_MS;
  const reconnectDeadline = new Date(now.getTime() + graceMs);
  const update = {
    "players.$[player].connected": false,
    "players.$[player].disconnectedAt": now,
    updatedAt: now,
    expiresAt: expiryFromNow(room),
  };
  if (room.status === "active") update["players.$[player].reconnectDeadline"] = reconnectDeadline;

  await rooms.updateOne(
    { code: room.code, "players.socketId": socketId },
    {
      $set: update,
    },
    { arrayFilters: [{ "player.socketId": socketId }] }
  );
  const player = room.players.find((item) => item.socketId === socketId);
  return {
    code: room.code,
    status: room.status,
    userId: player?.userId || null,
    name: player?.name || "Player",
    reconnectDeadline: room.status === "active" ? reconnectDeadline : null,
    graceMs,
  };
}

export async function getRoomBySocket(socketId) {
  const room = await getBattleRoomsCollection().findOne({
    "players.socketId": socketId,
  });
  return room ? { code: room.code, room: cleanRoom(room) } : null;
}

export async function findResumableRoomForUser(userId, preferredCode = null) {
  const rooms = getBattleRoomsCollection();
  const normalizedUserId = String(userId);
  const resumableStatuses = ["waiting", "active", "finished"];
  const validExpiry = { $gt: new Date() };

  if (preferredCode) {
    const room = await rooms.findOne({
      code: String(preferredCode),
      "players.userId": normalizedUserId,
      status: { $in: resumableStatuses },
      expiresAt: validExpiry,
    });
    if (room) return cleanRoom(room);
  }

  return cleanRoom(await rooms.findOne(
    {
      "players.userId": normalizedUserId,
      status: { $in: ["waiting", "active"] },
      expiresAt: validExpiry,
    },
    { sort: { updatedAt: -1 } }
  ));
}

export async function resumePlayerConnection({ code, userId, socketId }) {
  const rooms = getBattleRoomsCollection();
  const normalizedCode = String(code);
  const normalizedUserId = String(userId);
  const before = await rooms.findOne({
    code: normalizedCode,
    "players.userId": normalizedUserId,
    status: { $in: ["waiting", "active", "finished"] },
    expiresAt: { $gt: new Date() },
  });
  if (!before) return null;

  const previousPlayer = before.players.find(
    (player) => player.userId === normalizedUserId
  );
  const now = new Date();
  const updated = await rooms.findOneAndUpdate(
    { code: normalizedCode, "players.userId": normalizedUserId },
    {
      $set: {
        "players.$[player].socketId": socketId,
        "players.$[player].connected": true,
        "players.$[player].reconnectedAt": now,
        updatedAt: now,
        expiresAt: before.status === 'waiting' && before.origin === 'matchmaking' ? before.expiresAt : expiryFromNow(before),
      },
      $unset: {
        "players.$[player].disconnectedAt": "",
        "players.$[player].reconnectDeadline": "",
      },
    },
    {
      arrayFilters: [{ "player.userId": normalizedUserId }],
      returnDocument: "after",
    }
  );
  if (!updated) return null;
  return { room: cleanRoom(updated), previousSocketId: previousPlayer?.socketId || null };
}

export function buildBattleSnapshot(room, userId) {
  if (!room) return null;
  const normalizedUserId = String(userId);
  const me = room.players.find((player) => player.userId === normalizedUserId);
  if (!me) return null;

  const question = room.status === "active"
    ? room.questions?.[room.currentIndex]
    : null;
  const scores = publicBattleScores(room);
  const opponent = room.players.find((player) => player.userId !== normalizedUserId);
  const reveal = room.status === 'active' ? buildBattleReveal(room) : null;

  return {
    code: room.code,
    mode: room.mode || 'casual', origin: room.origin || 'private', rated: room.rated === true,
    status: room.status,
    subject: room.subject,
    topic: room.topic,
    questionCount: room.questionCount,
    currentIndex: room.currentIndex,
    totalQuestions: room.questions?.length || room.questionCount || 0,
    players: room.players.map((player) => ({
      userId: player.userId,
      name: player.name,
      connected: player.connected !== false,
    })),
    scores,
    myAnswered: Boolean(me.answered),
    mySelectedIndex: me.selectedIndex ?? null,
    myAnswer: storedBattleAnswer(me),
    currentQuestion: question ? buildPublicQuestion(room) : null,
    finishedAt: room.finishedAt || null,
    reveal,
    finishReason: room.finishReason || "completed",
    ...(room.status === 'finished' ? battleDecision(room) : { winnerUserId: null, loserUserId: null }),
    review: room.status === "finished" ? buildBattleReview(room, normalizedUserId) : undefined,
    opponentPresence: {
      connected: opponent?.connected !== false,
      reconnectDeadline: opponent?.reconnectDeadline || null,
    },
  };
}

export function buildBattleReview(room, userId) {
  if (!room || !Array.isArray(room.questions)) return [];
  const normalizedUserId = String(userId);
  const me = room.players?.find((player) => player.userId === normalizedUserId);
  const opponent = room.players?.find((player) => player.userId !== normalizedUserId);
  const limit = room.currentIndex !== undefined ? Math.min(room.questions.length, room.currentIndex + 1) : room.questions.length;

  return room.questions.slice(0, limit).map((q, idx) => {
    const myLog = me?.answerLog?.find((entry) => entry.questionIndex === idx);
    const oppLog = opponent?.answerLog?.find((entry) => entry.questionIndex === idx);
    return {
      questionIndex: idx,
      ...publicBattleQuestion(q),
      correctIndex: getCorrectAnswerIndex(q),
      correctAnswer: battleAnswerKey(q),
      explanation: q.explanation || q.solution || null,
      myAnswer: myLog ? {
        selectedIndex: myLog.selectedIndex ?? null,
        answer: storedBattleAnswer(myLog), points: myLog.points ?? (myLog.correct ? 10 : 0),
        correct: Boolean(myLog.correct),
        timedOut: Boolean(myLog.timedOut),
      } : (me?.selectedIndex !== undefined && room.currentIndex === idx ? {
        selectedIndex: me.selectedIndex ?? null,
        correct: Boolean(me.lastCorrect),
      } : null),
      opponentAnswer: oppLog ? {
        selectedIndex: oppLog.selectedIndex ?? null,
        answer: storedBattleAnswer(oppLog), points: oppLog.points ?? (oppLog.correct ? 10 : 0),
        correct: Boolean(oppLog.correct),
        timedOut: Boolean(oppLog.timedOut),
      } : (opponent?.selectedIndex !== undefined && room.currentIndex === idx ? {
        selectedIndex: opponent.selectedIndex ?? null,
        correct: Boolean(opponent.lastCorrect),
      } : null),
    };
  });
}

export async function forfeitRoom(code, forfeitingUserId) {
  const rooms = getBattleRoomsCollection();
  const normalizedCode = String(code);
  const normalizedUserId = String(forfeitingUserId);
  const room = await rooms.findOne({
    code: normalizedCode,
    status: "active",
    "players.userId": normalizedUserId,
  });
  if (!room || room.players.length !== 2) return null;
  const opponent = room.players.find((p) => p.userId !== normalizedUserId);
  if (!opponent) return null;

  const now = new Date();
  const update = {
    status: "finished",
    realtimeVersion: randomUUID(),
    finishReason: "forfeit",
    winnerUserId: opponent.userId,
    loserUserId: normalizedUserId,
    finishedAt: now,
    updatedAt: now,
    expiresAt: expiryFromNow(),
  };

  const finished = await rooms.findOneAndUpdate(
    { code: normalizedCode, status: "active" },
    { $set: update },
    { returnDocument: "after" }
  );
  return cleanRoom(finished);
}

