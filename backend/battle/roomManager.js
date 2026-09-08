import {
  getBattleRoomsCollection,
} from "../config/mongodb.js";
import { getActiveBattleSeason } from "./battleSeasonService.js";

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const BATTLE_RECONNECT_GRACE_MS = Number(process.env.BATTLE_RECONNECT_GRACE_MS) || 60_000;
const BATTLE_DEPLOYMENT_GRACE_MS = Number(process.env.BATTLE_DEPLOYMENT_GRACE_MS) || 180_000;
const QUESTION_TIME_MS = Number(process.env.BATTLE_QUESTION_TIME_MS) || 30_000;
const QUESTION_REVEAL_MS = Number(process.env.BATTLE_QUESTION_REVEAL_MS) || 2_000;

function createQuestionWindow(now = new Date()) {
  return { questionStartedAt: now, questionDeadline: new Date(now.getTime() + QUESTION_TIME_MS) };
}

// Question documents historically store the key in more than one form: an
// option index, an A-D letter, or the option text itself.  Battles must use a
// single index internally, otherwise a perfectly valid selected option is
// rejected as an "invalid answer key".
export function getCorrectAnswerIndex(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const answer = question?.correctAnswer;

  if (Number.isInteger(answer) && answer >= 0 && answer < options.length) return answer;

  if (typeof answer !== "string") return null;
  const value = answer.trim();
  const optionIndex = options.findIndex((option) => String(option).trim() === value);
  if (optionIndex >= 0) return optionIndex;

  const letter = value.match(/^\(?\s*([a-z])\s*\)?[.):]?$/i)?.[1]?.toUpperCase();
  if (letter) {
    const letterIndex = letter.charCodeAt(0) - 65;
    if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;
  }

  if (/^\d+$/.test(value)) {
    const numericIndex = Number(value);
    if (numericIndex >= 0 && numericIndex < options.length) return numericIndex;
  }
  return null;
}

function expiryFromNow() {
  return new Date(Date.now() + ROOM_TTL_MS);
}

function generateCode() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function cleanRoom(room) {
  if (!room) return null;
  const { _id, ...clean } = room;
  return clean;
}

function scoresFromRoom(room) {
  if (!room) return {};
  return Object.fromEntries(room.players.map((player) => [
    player.userId,
    {
      name: player.name,
      score: player.score,
      answered: player.answered,
      lastAnswer: player.lastAnswer ?? null,
      lastCorrect: player.lastCorrect ?? null,
      connected: player.connected !== false,
    },
  ]));
}

export async function createRoom(socketId, playerName, subject, topic, questionCount, ownerUserId) {
  const rooms = getBattleRoomsCollection();
  const normalizedOwnerUserId = String(ownerUserId);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = generateCode();
    const now = new Date();
    const activeSeason = await getActiveBattleSeason(now);
    try {
      await rooms.insertOne({
        code,
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
      });
      return code;
    } catch (error) {
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
          expiresAt: expiryFromNow(),
        },
      },
      {
        arrayFilters: [{ "player.userId": normalizedUserId }],
        returnDocument: "after",
      }
    );
    return { room: cleanRoom(rebound), resumed: true };
  }

  const result = await rooms.findOneAndUpdate(
    {
      code: normalizedCode,
      status: "waiting",
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
    { returnDocument: "after" }
  );

  if (result) return { room: cleanRoom(result) };

  const room = await getRoom(normalizedCode);
  if (!room) return { error: "Room not found" };
  return { error: room.status !== "waiting" ? "Game already started" : "Room is full" };
}

export async function deleteRoom(code) {
  await getBattleRoomsCollection().deleteOne({ code: String(code) });
}

export async function setQuestions(code, questions) {
  const now = new Date();
  const timing = createQuestionWindow(now);
  const room = await getBattleRoomsCollection().findOneAndUpdate(
    { code: String(code), status: "waiting" },
    {
      $set: {
        questions,
        currentIndex: 0,
        status: "active",
        questionStartedAt: timing.questionStartedAt,
        questionDeadline: timing.questionDeadline,
        updatedAt: now,
        expiresAt: expiryFromNow(),
      },
    },
    { returnDocument: "after" }
  );
  return cleanRoom(room);
}

export async function getCurrentQuestion(code) {
  const room = await getRoom(code);
  return room?.questions?.[room.currentIndex] || null;
}

export function buildPublicQuestion(room) {
  if (!room || room.status !== "active") return null;
  const question = room.questions?.[room.currentIndex];
  if (!question) return null;
  return { question: question.question, options: question.options, questionIndex: room.currentIndex, total: room.questions.length, deadline: room.questionDeadline };
}

export async function getScores(code) {
  return scoresFromRoom(await getRoom(code));
}

export async function submitAnswer({ code, userId, questionIndex, selectedIndex, now = new Date() }) {
  const rooms = getBattleRoomsCollection();
  const normalizedCode = String(code);
  const normalizedUserId = String(userId);
  const room = await rooms.findOne({ code: normalizedCode, status: "active", "players.userId": normalizedUserId });
  if (!room) return { ok: false, reason: "room-not-active" };
  if (room.currentIndex !== questionIndex) return { ok: false, reason: "stale-question" };

  const question = room.questions?.[room.currentIndex];
  const player = room.players.find((item) => item.userId === normalizedUserId);
  if (!question || !Array.isArray(question.options)) return { ok: false, reason: "invalid-question" };
  if (!player || player.answered) return { ok: false, reason: "already-answered" };
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= question.options.length) return { ok: false, reason: "invalid-option" };
  if (room.questionDeadline && now.getTime() > new Date(room.questionDeadline).getTime()) return { ok: false, reason: "deadline-expired" };

  const correctIndex = getCorrectAnswerIndex(question);
  if (correctIndex === null) return { ok: false, reason: "invalid-answer-key" };
  const isCorrect = selectedIndex === correctIndex;
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
        "players.$[player].lastCorrect": isCorrect,
        "players.$[player].answeredAt": now,
        "players.$[player].responseTimeMs": responseTimeMs,
        updatedAt: now,
        expiresAt: expiryFromNow(),
      },
      $push: {
        "players.$[player].answerLog": {
          questionIndex,
          selectedIndex,
          correct: isCorrect,
          responseTimeMs,
          timedOut: false,
          answeredAt: now,
        },
      },
      ...(isCorrect ? { $inc: { "players.$[player].score": 10 } } : {}),
    },
    { arrayFilters: [{ "player.userId": normalizedUserId, "player.answered": false }] }
  );

  if (result.modifiedCount !== 1) return { ok: false, reason: "already-answered" };

  const updated = await getRoom(normalizedCode);
  const allAnswered = updated.players.length === 2 && updated.players.every((item) => item.answered);
  return {
    ok: true, isCorrect,
    allAnswered,
    questionIndex, correctIndex: allAnswered ? correctIndex : null,
    scores: scoresFromRoom(updated),
  };
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
      ? Math.max(0, now.getTime() - new Date(room.questionStartedAt).getTime())
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
          "players.$[player].lastCorrect": false,
          "players.$[player].answeredAt": now,
          "players.$[player].responseTimeMs": responseTimeMs,
          questionResolvedAt: now,
          questionResolutionIndex: expectedIndex,
          questionAdvanceAt: new Date(now.getTime() + QUESTION_REVEAL_MS),
          updatedAt: now,
          expiresAt: expiryFromNow(),
        },
        $push: {
          "players.$[player].answerLog": {
            questionIndex: expectedIndex,
            selectedIndex: null,
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

  const now = new Date();
  if (expectedIndex + 1 >= room.questions.length) {
    const result = await rooms.findOneAndUpdate(
      { code: normalizedCode, status: "active", currentIndex: expectedIndex },
      {
        $set: {
          status: "finished",
          finishReason: "completed",
          finishedAt: now,
          updatedAt: now,
          expiresAt: expiryFromNow(),
        },
      },
      { returnDocument: "after" }
    );
    return { advanced: Boolean(result), finished: Boolean(result), room: cleanRoom(result) };
  }

  const timing = createQuestionWindow(now);
  const updated = await rooms.findOneAndUpdate(
    { code: normalizedCode, status: "active", currentIndex: expectedIndex },
    {
      $set: {
        currentIndex: expectedIndex + 1,
        "players.$[].answered": false,
        questionStartedAt: timing.questionStartedAt,
        questionDeadline: timing.questionDeadline,
        updatedAt: now,
        expiresAt: expiryFromNow(),
      },
      $unset: {
        "players.$[].selectedIndex": "",
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
    expiresAt: expiryFromNow(),
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

  if (preferredCode) {
    const room = await rooms.findOne({
      code: String(preferredCode),
      "players.userId": normalizedUserId,
      status: { $in: resumableStatuses },
    });
    if (room) return cleanRoom(room);
  }

  return cleanRoom(await rooms.findOne(
    {
      "players.userId": normalizedUserId,
      status: { $in: ["waiting", "active"] },
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
        expiresAt: expiryFromNow(),
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
  const scores = Object.fromEntries(room.players.map((player) => [
    player.userId,
    {
      name: player.name,
      score: player.score,
      answered: Boolean(player.answered),
      connected: player.connected !== false,
      ...(player.userId === normalizedUserId
        ? { lastCorrect: player.lastCorrect ?? null }
        : {}),
    },
  ]));
  const opponent = room.players.find((player) => player.userId !== normalizedUserId);
  const allAnswered = room.status === "active"
    && room.players.length === 2
    && room.players.every((player) => player.answered);
  const reveal = allAnswered && question
    ? {
        questionIndex: room.currentIndex,
        correctIndex: getCorrectAnswerIndex(question),
        selections: Object.fromEntries(room.players.map((player) => [
          player.userId,
          player.selectedIndex ?? null,
        ])),
      }
    : null;

  return {
    code: room.code,
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
    currentQuestion: question ? {
      question: question.question,
      options: question.options,
      questionIndex: room.currentIndex,
      total: room.questions.length,
      deadline: room.questionDeadline || null,
    } : null,
    finishedAt: room.finishedAt || null,
    reveal,
    finishReason: room.finishReason || "completed",
    winnerUserId: room.winnerUserId || null,
    loserUserId: room.loserUserId || null,
    opponentPresence: {
      connected: opponent?.connected !== false,
      reconnectDeadline: opponent?.reconnectDeadline || null,
    },
  };
}
