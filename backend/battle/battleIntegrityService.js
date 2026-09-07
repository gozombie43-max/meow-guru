import { getBattleIntegrityEventsCollection, getBattleMatchesCollection } from "../config/mongodb.js";

const FAST_CORRECT_MS = Number(process.env.BATTLE_INTEGRITY_FAST_CORRECT_MS) || 900;
const EXTREME_RESPONSE_MS = Number(process.env.BATTLE_INTEGRITY_EXTREME_MS) || 200;
const pairKey = (a, b) => [String(a), String(b)].sort().join(":");

export async function recordBattleIntegritySignal({ dedupeKey, userId, opponentUserId = null, roomCode = null, seasonKey = null, signalType, severity = "low", riskPoints = 0, details = {} }) {
  const now = new Date();
  await getBattleIntegrityEventsCollection().updateOne({ dedupeKey }, { $set: { userId: String(userId), opponentUserId: opponentUserId ? String(opponentUserId) : null, roomCode, seasonKey, signalType, severity, riskPoints, details, lastSeenAt: now }, $setOnInsert: { dedupeKey, status: "open", count: 0, firstSeenAt: now, createdAt: now }, $inc: { count: 1 } }, { upsert: true });
}

export function analyzeAnswerLog(answerLog) {
  const valid = (Array.isArray(answerLog) ? answerLog : []).filter((entry) => !entry.timedOut && Number.isFinite(entry.responseTimeMs));
  const correct = valid.filter((entry) => entry.correct);
  const fastCorrect = correct.filter((entry) => entry.responseTimeMs <= FAST_CORRECT_MS);
  const extremeCorrect = correct.filter((entry) => entry.responseTimeMs <= EXTREME_RESPONSE_MS);
  return { attempts: valid.length, correct: correct.length, accuracy: valid.length ? correct.length / valid.length : 0, fastCorrect: fastCorrect.length, extremeCorrect: extremeCorrect.length, averageResponseMs: valid.length ? Math.round(valid.reduce((total, entry) => total + entry.responseTimeMs, 0) / valid.length) : null };
}

async function analyzePlayerTiming(match, player, opponent) {
  const metrics = analyzeAnswerLog(player.answerLog);
  const common = { userId: player.userId, opponentUserId: opponent.userId, roomCode: match.roomCode, seasonKey: match.seasonKey, details: metrics };
  const writes = [];
  if (metrics.extremeCorrect >= 3) writes.push(recordBattleIntegritySignal({ ...common, dedupeKey: `extreme-response:${match.roomCode}:${player.userId}`, signalType: "extreme-response-pattern", severity: "high", riskPoints: 45 }));
  if (metrics.correct >= 6 && metrics.fastCorrect >= 5 && metrics.accuracy >= .8) writes.push(recordBattleIntegritySignal({ ...common, dedupeKey: `fast-correct:${match.roomCode}:${player.userId}`, signalType: "fast-correct-pattern", severity: "medium", riskPoints: 25 }));
  await Promise.all(writes);
}

async function analyzeRepeatedPairing(match, a, b) {
  if (!match.rated) return;
  const since = new Date(new Date(match.finishedAt).getTime() - 86_400_000);
  const recent = await getBattleMatchesCollection().find({ rated: true, finishedAt: { $gte: since }, "players.userId": { $all: [a.userId, b.userId] } }).project({ finishReason: 1, players: 1 }).toArray();
  if (recent.length < 8) return;
  const wins = new Map(), forfeits = recent.filter((item) => item.finishReason === "forfeit").length;
  for (const item of recent) for (const player of item.players || []) if (player.result === "win") wins.set(player.userId, (wins.get(player.userId) || 0) + 1);
  const dominantWins = Math.max(wins.get(a.userId) || 0, wins.get(b.userId) || 0), key = pairKey(a.userId, b.userId), day = since.toISOString().slice(0, 10), details = { matches24h: recent.length, dominantWins, forfeits }, common = { userId: a.userId, opponentUserId: b.userId, roomCode: match.roomCode, seasonKey: match.seasonKey, details };
  const writes = [recordBattleIntegritySignal({ ...common, dedupeKey: `repeated-pair:${key}:${day}`, signalType: "repeated-opponent", severity: "medium", riskPoints: 20 })];
  if (recent.length >= 10 && dominantWins / recent.length >= .8) writes.push(recordBattleIntegritySignal({ ...common, dedupeKey: `possible-boosting:${key}:${day}`, signalType: "possible-rating-boosting", severity: "high", riskPoints: 40 }));
  if (forfeits >= 4) writes.push(recordBattleIntegritySignal({ ...common, dedupeKey: `forfeit-farming:${key}:${day}`, signalType: "repeated-forfeit-pattern", severity: "medium", riskPoints: 25 }));
  await Promise.all(writes);
}

export async function analyzeSettledBattle(match) {
  if (!match || !Array.isArray(match.players) || match.players.length !== 2) return;
  const [a, b] = match.players;
  await Promise.allSettled([analyzePlayerTiming(match, a, b), analyzePlayerTiming(match, b, a), analyzeRepeatedPairing(match, a, b)]);
}
