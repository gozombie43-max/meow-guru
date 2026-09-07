import { randomUUID } from "node:crypto";
import { getBattleMatchmakingQueueCollection, getBattleProfilesCollection, getBattleRoomsCollection, withMongoTransaction } from "../config/mongodb.js";
import { DEFAULT_BATTLE_RATING } from "./battleRatingService.js";
import { getBattleRealtimeServer } from "./battleRealtime.js";
import { getActiveBattleSeason } from "./battleSeasonService.js";

const QUEUE_TTL_MS = 10 * 60 * 1000;
export function getAllowedRatingRange(queuedAt, now = new Date()) { return Math.min(400, 100 + Math.floor(Math.max(0, now - new Date(queuedAt)) / 15_000) * 50); }
const code = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
export async function joinMatchmakingQueue({ userId, displayName, subject, topic, questionCount }) {
  const profiles = getBattleProfilesCollection(); const now = new Date();
  const profile = await profiles.findOne({ userId: String(userId) });
  const ticket = { userId: String(userId), displayName: String(displayName || "Player").slice(0, 40), rating: profile?.rating ?? DEFAULT_BATTLE_RATING, subject: String(subject || "mathematics"), topic: String(topic || "all"), questionCount: Number(questionCount) || 10, status: "waiting", queuedAt: now, updatedAt: now, expiresAt: new Date(+now + QUEUE_TTL_MS) };
  await getBattleMatchmakingQueueCollection().updateOne({ userId: ticket.userId }, { $set: ticket, $unset: { matchmakingId: "", matchedAt: "", roomCode: "" } }, { upsert: true });
  return ticket;
}
export async function cancelMatchmakingQueue(userId) { return (await getBattleMatchmakingQueueCollection().updateOne({ userId: String(userId), status: "waiting" }, { $set: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() } })).modifiedCount === 1; }
async function pair(firstTicket, secondTicket) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const roomCode = code(); const matchmakingId = randomUUID();
    try {
      const result = await withMongoTransaction(async ({ session }) => {
        const queue = getBattleMatchmakingQueueCollection(); const rooms = getBattleRoomsCollection();
        const first = await queue.findOne({ _id: firstTicket._id, status: "waiting" }, { session });
        const second = await queue.findOne({ _id: secondTicket._id, status: "waiting" }, { session });
        if (!first || !second || first.userId === second.userId || first.subject !== second.subject || first.topic !== second.topic || first.questionCount !== second.questionCount || Math.abs(first.rating - second.rating) > Math.max(getAllowedRatingRange(first.queuedAt), getAllowedRatingRange(second.queuedAt))) return null;
        const now = new Date(); const activeSeason = await getActiveBattleSeason(now); const claim = await queue.updateMany({ _id: { $in: [first._id, second._id] }, status: "waiting" }, { $set: { status: "matched", matchmakingId, roomCode, matchedAt: now, updatedAt: now } }, { session });
        if (claim.modifiedCount !== 2) throw new Error("MATCHMAKING_CLAIM_CONFLICT");
        await rooms.insertOne({ code: roomCode, matchmakingId, seasonKey: activeSeason?.key || null, ownerUserId: first.userId, subject: first.subject, topic: first.topic, questionCount: first.questionCount, questions: [], currentIndex: 0, players: [first, second].map((ticket) => ({ userId: ticket.userId, socketId: null, name: ticket.displayName, score: 0, answered: false, connected: false, joinedAt: now, matchmakingRating: ticket.rating })), status: "waiting", createdAt: now, updatedAt: now, expiresAt: new Date(+now + 2 * 60 * 60 * 1000) }, { session });
        return { matchmakingId, roomCode, first, second, ratingDifference: Math.abs(first.rating - second.rating) };
      });
      return result;
    } catch (error) { if (error?.code === 11000) continue; if (error?.message === "MATCHMAKING_CLAIM_CONFLICT") return null; throw error; }
  }
  throw new Error("Unable to allocate matchmaking room");
}
export async function runMatchmakingPass() {
  const queue = getBattleMatchmakingQueueCollection(); const now = new Date(); const tickets = await queue.find({ status: "waiting" }).sort({ queuedAt: 1 }).limit(25).toArray(); const matches = [];
  for (const ticket of tickets) { const first = await queue.findOne({ _id: ticket._id, status: "waiting" }); if (!first) continue; const range = getAllowedRatingRange(first.queuedAt, now); const second = await queue.findOne({ status: "waiting", userId: { $ne: first.userId }, subject: first.subject, topic: first.topic, questionCount: first.questionCount, rating: { $gte: first.rating - range, $lte: first.rating + range } }, { sort: { queuedAt: 1 } }); if (second) { const match = await pair(first, second); if (match) matches.push(match); } }
  return matches;
}
export function emitMatchFound(match) { const io = getBattleRealtimeServer(); if (!io) return; for (const player of [match.first, match.second]) { const opponent = player.userId === match.first.userId ? match.second : match.first; io.to(`user:${player.userId}`).emit("matchmaking:matched", { roomCode: match.roomCode, matchmakingId: match.matchmakingId, opponent: { userId: opponent.userId, name: opponent.displayName, rating: opponent.rating }, ratingDifference: match.ratingDifference, subject: player.subject, topic: player.topic, questionCount: player.questionCount }); } }
