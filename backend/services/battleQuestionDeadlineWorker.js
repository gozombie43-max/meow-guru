import { getBattleRoomsCollection } from "../config/mongodb.js";
import { advanceQuestion } from "../battle/roomManager.js";
import { getBattleRealtimeServer } from "../battle/battleRealtime.js";
import { settleBattleResult } from "../battle/battleResultService.js";
import { signBattleRematchToken } from "../auth/jwt.js";
import { sendPushToUser } from "./pushNotificationService.js";

const POLL_MS = Number(process.env.BATTLE_QUESTION_WORKER_POLL_MS) || 1_000;
const REVEAL_DELAY_MS = Number(process.env.BATTLE_REVEAL_DELAY_MS) || 2_000;
const ROOM_TTL_MS = 2 * 60 * 60 * 1_000;
const BATCH_SIZE = 25;

let timer = null;
let running = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildScores(room) {
  return Object.fromEntries((room.players || []).map((player) => [
    player.userId,
    {
      name: player.name,
      score: player.score || 0,
      answered: Boolean(player.answered),
      connected: player.connected !== false,
    },
  ]));
}

function buildMatchStats(entry) {
  const answers = Array.isArray(entry?.answerLog) ? entry.answerLog : [];
  const answered = answers.filter((answer) => !answer.timedOut);
  const correct = answers.filter((answer) => answer.correct);
  const times = answered.map((answer) => answer.responseTimeMs).filter(Number.isFinite);
  return {
    correct: correct.length,
    total: answers.length,
    accuracy: answers.length ? Math.round((correct.length / answers.length) * 100) : 0,
    averageResponseMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
    timedOut: answers.filter((answer) => answer.timedOut).length,
  };
}

async function notifyFinished(room, scores) {
  const scoredPlayers = (room.players || []).map((player) => ({
    player,
    score: scores[player.userId]?.score ?? player.score ?? 0,
  }));
  if (scoredPlayers.length !== 2) return;
  const maxScore = Math.max(...scoredPlayers.map((entry) => entry.score));
  const winnerCount = scoredPlayers.filter((entry) => entry.score === maxScore).length;

  await Promise.allSettled(scoredPlayers.map(async ({ player, score }) => {
    if (!player.userId) return;
    const opponent = scoredPlayers.find((entry) => entry.player.userId !== player.userId);
    if (!opponent) return;
    let title;
    let body;
    let result;
    if (winnerCount > 1) {
      title = "Battle Draw 🤝";
      body = `You and ${opponent.player.name} finished ${score}-${opponent.score}.`;
      result = "draw";
    } else if (score === maxScore) {
      title = "You Won! 🏆";
      body = `You defeated ${opponent.player.name} ${score}-${opponent.score}.`;
      result = "win";
    } else {
      title = "Battle Finished ⚔️";
      body = `${opponent.player.name} won ${opponent.score}-${score}. Ready for a rematch?`;
      result = "loss";
    }
    await sendPushToUser(player.userId, {
      title,
      body,
      route: "/battle",
      category: "battleResults",
      data: {
        type: "battle_result",
        result,
        score,
        opponentScore: opponent.score,
        opponentName: opponent.player.name,
        subject: room.subject || "",
        topic: room.topic || "",
      },
      centerKey: `battle-result:${room.code}:${player.userId}`,
    });
  }));
}

async function finishExpiredBattle(room) {
  const settlement = await settleBattleResult(room).catch((error) => {
    console.error("Battle deadline settlement failed:", error);
    return null;
  });
  const io = getBattleRealtimeServer();
  const scores = buildScores(room);

  if (io) {
    for (const player of room.players || []) {
      const opponent = room.players.find((candidate) => candidate.userId !== player.userId);
      const matchPlayer = settlement?.match?.players?.find((entry) => entry.userId === player.userId);
      const opponentMatchPlayer = settlement?.match?.players?.find((entry) => entry.userId === opponent?.userId);
      const rematchToken = player.userId && opponent?.userId
        ? signBattleRematchToken({
            requesterUserId: player.userId,
            opponentUserId: opponent.userId,
            opponentName: opponent.name,
            subject: room.subject,
            topic: room.topic,
            questionCount: room.questionCount,
          })
        : null;
      if (!player.socketId) continue;
      io.to(player.socketId).emit("game:end", {
        scores,
        finishReason: room.finishReason || "completed",
        winnerUserId: room.winnerUserId || null,
        rematchToken,
        opponentName: opponent?.name || "Opponent",
        matchStats: { me: buildMatchStats(matchPlayer), opponent: buildMatchStats(opponentMatchPlayer) },
        rating: matchPlayer ? {
          lifetime: { before: matchPlayer.ratingBefore, after: matchPlayer.ratingAfter, delta: matchPlayer.ratingDelta },
          season: matchPlayer.seasonRatingAfter !== null ? {
            before: matchPlayer.seasonRatingBefore,
            after: matchPlayer.seasonRatingAfter,
            delta: matchPlayer.seasonRatingDelta,
            tierBefore: matchPlayer.seasonTierBefore,
            tierAfter: matchPlayer.seasonTierAfter,
          } : null,
        } : null,
      });
    }
  }

  void notifyFinished(room, scores).catch((error) => {
    console.error("Battle deadline result notification failed:", error);
  });
}

export async function expireBattleQuestion(candidate, now = new Date()) {
  if (!candidate || candidate.status !== "active") return null;
  const expectedIndex = Number(candidate.currentIndex);
  if (!Number.isInteger(expectedIndex)) return null;
  const deadline = candidate.questionDeadline ? new Date(candidate.questionDeadline) : null;
  if (!deadline || deadline > now) return null;

  const timeoutEntry = {
    questionIndex: expectedIndex,
    selectedIndex: null,
    correct: false,
    responseTimeMs: null,
    timedOut: true,
    answeredAt: now,
  };

  const room = await getBattleRoomsCollection().findOneAndUpdate(
    {
      _id: candidate._id,
      status: "active",
      currentIndex: expectedIndex,
      questionDeadline: { $lte: now },
    },
    [{
      $set: {
        players: {
          $map: {
            input: "$players",
            as: "player",
            in: {
              $cond: [
                { $eq: ["$$player.answered", true] },
                "$$player",
                {
                  $mergeObjects: [
                    "$$player",
                    {
                      answered: true,
                      selectedIndex: null,
                      lastCorrect: false,
                      answeredAt: now,
                      responseTimeMs: null,
                      answerLog: {
                        $concatArrays: [{ $ifNull: ["$$player.answerLog", []] }, [timeoutEntry]],
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
        updatedAt: now,
        expiresAt: new Date(now.getTime() + ROOM_TTL_MS),
      },
    }],
    { returnDocument: "after" }
  );

  if (!room || room.status !== "active" || room.currentIndex !== expectedIndex) return null;

  const question = room.questions?.[expectedIndex];
  const correctIndex = Number(question?.correctAnswer);
  const io = getBattleRealtimeServer();
  if (io) {
    io.to(room.code).emit("game:scores", { scores: buildScores(room) });
    io.to(room.code).emit("game:reveal", {
      questionIndex: expectedIndex,
      correctIndex: Number.isInteger(correctIndex) ? correctIndex : null,
      selections: Object.fromEntries(room.players.map((player) => [player.userId, player.selectedIndex ?? null])),
      timedOut: true,
    });
  }

  if (REVEAL_DELAY_MS > 0) await sleep(REVEAL_DELAY_MS);

  const transition = await advanceQuestion(room.code, expectedIndex);
  if (!transition?.advanced) return { expired: true, advanced: false, room };
  if (transition.finished) {
    await finishExpiredBattle(transition.room);
    return { expired: true, advanced: true, finished: true, room: transition.room };
  }

  const nextRoom = transition.room;
  const nextQuestion = nextRoom.questions?.[nextRoom.currentIndex];
  if (io && nextQuestion) {
    io.to(nextRoom.code).emit("game:question", {
      question: nextQuestion.question,
      options: nextQuestion.options,
      questionIndex: nextRoom.currentIndex,
      total: nextRoom.questions.length,
      deadline: nextRoom.questionDeadline,
    });
  }
  return { expired: true, advanced: true, finished: false, room: nextRoom };
}

export async function runBattleQuestionDeadlineWorkerOnce() {
  if (running) return false;
  running = true;
  try {
    const now = new Date();
    const candidates = await getBattleRoomsCollection()
      .find({ status: "active", questionDeadline: { $lte: now } })
      .sort({ questionDeadline: 1 })
      .limit(BATCH_SIZE)
      .toArray();
    const results = await Promise.allSettled(candidates.map((room) => expireBattleQuestion(room, now)));
    for (const result of results) {
      if (result.status === "rejected") console.error("Battle question deadline processing failed:", result.reason);
    }
    return true;
  } finally {
    running = false;
  }
}

export async function startBattleQuestionDeadlineWorker() {
  if (timer) return;
  await getBattleRoomsCollection().createIndex({ status: 1, questionDeadline: 1 });
  await runBattleQuestionDeadlineWorkerOnce();
  timer = setInterval(() => {
    void runBattleQuestionDeadlineWorkerOnce().catch((error) => {
      console.error("Battle question deadline worker failed:", error);
    });
  }, POLL_MS);
  console.log(`Battle question deadline worker started (${POLL_MS}ms) ✅`);
}

export function stopBattleQuestionDeadlineWorker() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export async function waitForBattleQuestionDeadlineWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await sleep(100);
  return !running;
}
