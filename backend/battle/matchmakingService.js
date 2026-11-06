import { randomUUID } from 'node:crypto';
import { getBattleMatchmakingQueueCollection, getBattleProfilesCollection, getBattleRoomsCollection, withMongoTransaction } from '../config/mongodb.js';
import { DEFAULT_BATTLE_RATING } from './battleRatingService.js';
import { getBattleRealtimeServer } from './battleRealtime.js';
import { getActiveBattleSeason } from './battleSeasonService.js';
import { generateBattleCode } from './battleProtocol.js';
import { battlePolicy } from './battlePolicy.js';
import { claimBattleLease, transferBattleLease, releaseBattleLeases } from './battleLifecycle.js';
import { canUseMatchmaking } from './battleFeatureGuards.js';

const QUEUE_TTL_MS = 10 * 60 * 1000;
export function getAllowedRatingRange(queuedAt, now = new Date()) { return Math.min(400, 100 + Math.floor(Math.max(0, now - new Date(queuedAt)) / 15_000) * 50); }
export async function getMatchmakingTicket(userId) {
  return getBattleMatchmakingQueueCollection().findOne({ userId: String(userId), status: 'waiting', expiresAt: { $gt: new Date() } });
}
export async function joinMatchmakingQueue({ userId, displayName, subject, topic, questionCount }) {
  if (!canUseMatchmaking(userId)) throw new Error('Matchmaking is temporarily unavailable.');
  const id = String(userId), now = new Date();
  return withMongoTransaction(async ({ session }) => {
    const queue = getBattleMatchmakingQueueCollection();
    const existing = await queue.findOne({ userId: id, status: 'waiting', expiresAt: { $gt: now } }, { session });
    if (existing) return existing;
    const profile = await getBattleProfilesCollection().findOne({ userId: id }, { session });
    const ticket = { userId: id, displayName: String(displayName || 'Player').slice(0, 40), rating: profile?.rating ?? DEFAULT_BATTLE_RATING,
      subject: String(subject || 'mathematics'), topic: String(topic || 'all'), questionCount: Number(questionCount) || 10,
      status: 'waiting', queuedAt: now, updatedAt: now, expiresAt: new Date(+now + QUEUE_TTL_MS) };
    await claimBattleLease({ userId: id, kind: 'queue', resourceId: id, expiresAt: ticket.expiresAt, session });
    await queue.updateOne({ userId: id }, { $set: ticket, $unset: { matchmakingId: '', matchedAt: '', roomCode: '' } }, { upsert: true, session });
    return ticket;
  });
}
export async function cancelMatchmakingQueue(userId) {
  return withMongoTransaction(async ({ session }) => {
    const id = String(userId);
    const result = await getBattleMatchmakingQueueCollection().updateOne({ userId: id, status: 'waiting' }, { $set: { status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() } }, { session });
    if (result.modifiedCount === 1) await releaseBattleLeases('queue', id, { session });
    return result.modifiedCount === 1;
  });
}
const MATCHMAKING_SCAN_LIMIT = 200;
function bucketKey(ticket) { return `${ticket.subject}\0${ticket.topic}\0${ticket.questionCount}`; }
function groupEligibleTickets(tickets) {
  const buckets = new Map();
  for (const ticket of tickets) {
    if (!canUseMatchmaking(ticket.userId)) continue;
    const key = bucketKey(ticket);
    let list = buckets.get(key);
    if (!list) { list = []; buckets.set(key, list); }
    list.push(ticket);
  }
  return buckets;
}
export function canPairTickets(first, second, now = new Date()) {
  if (!first || !second || first.userId === second.userId) return false;
  if (!canUseMatchmaking(first.userId) || !canUseMatchmaking(second.userId)) return false;
  if (first.subject !== second.subject || first.topic !== second.topic || first.questionCount !== second.questionCount) return false;
  return Math.abs(first.rating - second.rating) <= Math.max(getAllowedRatingRange(first.queuedAt, now), getAllowedRatingRange(second.queuedAt, now));
}
export async function hasMatchmakingCandidates(now = new Date()) {
  const tickets = await getBattleMatchmakingQueueCollection()
    .find(
      { status: 'waiting', expiresAt: { $gt: now } },
      { projection: { userId: 1, subject: 1, topic: 1, questionCount: 1, rating: 1, queuedAt: 1 } },
    )
    .sort({ queuedAt: 1 })
    .limit(MATCHMAKING_SCAN_LIMIT)
    .toArray();
  if (tickets.length < 2) return false;
  for (const bucket of groupEligibleTickets(tickets).values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        if (canPairTickets(bucket[i], bucket[j], now)) return true;
      }
    }
  }
  return tickets.length >= MATCHMAKING_SCAN_LIMIT;
}
async function pair(firstTicket, secondTicket) {
  if (!canUseMatchmaking(firstTicket.userId) || !canUseMatchmaking(secondTicket.userId)) return null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const roomCode = generateBattleCode(), matchmakingId = randomUUID();
    try {
      return await withMongoTransaction(async ({ session }) => {
        const queue = getBattleMatchmakingQueueCollection(), rooms = getBattleRoomsCollection(), now = new Date();
        const first = await queue.findOne({ _id: firstTicket._id, status: 'waiting', expiresAt: { $gt: now } }, { session });
        const second = await queue.findOne({ _id: secondTicket._id, status: 'waiting', expiresAt: { $gt: now } }, { session });
        if (!canPairTickets(first, second, now)) return null;
        const activeSeason = await getActiveBattleSeason(now), expiresAt = new Date(+now + 2 * 60 * 1000);
        for (const ticket of [first, second]) await transferBattleLease({ userId: ticket.userId, fromKind: 'queue', fromResource: ticket.userId, resourceId: roomCode, expiresAt, session });
        const claim = await queue.updateMany({ _id: { $in: [first._id, second._id] }, status: 'waiting' }, { $set: { status: 'matched', matchmakingId, roomCode, matchedAt: now, updatedAt: now } }, { session });
        if (claim.modifiedCount !== 2) throw new Error('MATCHMAKING_CLAIM_CONFLICT');
        await rooms.insertOne({ code: roomCode, ...battlePolicy('matchmaking'), language: 'en', supportsImages: true,
          realtimeVersion: randomUUID(), matchmakingId, seasonKey: activeSeason?.key || null, ownerUserId: first.userId,
          subject: first.subject, topic: first.topic, questionCount: first.questionCount, questions: [], currentIndex: 0,
          players: [first, second].map(ticket => ({ userId: ticket.userId, socketId: null, name: ticket.displayName, score: 0, answered: false, connected: false, joinedAt: now, matchmakingRating: ticket.rating })),
          status: 'waiting', createdAt: now, updatedAt: now, expiresAt }, { session });
        return { matchmakingId, roomCode, first, second, ratingDifference: Math.abs(first.rating - second.rating) };
      });
    } catch (error) { if (error?.code === 11000) continue; if (error?.message === 'MATCHMAKING_CLAIM_CONFLICT') return null; throw error; }
  }
  throw new Error('Unable to allocate matchmaking room');
}
export async function runMatchmakingPass({ limit = 25, canContinue = async () => true } = {}) {
  const maxMatches = Math.max(1, Math.min(25, limit));
  const scanLimit = limit < 25 ? Math.min(MATCHMAKING_SCAN_LIMIT, Math.max(25, maxMatches * 8)) : MATCHMAKING_SCAN_LIMIT;
  const queue = getBattleMatchmakingQueueCollection(), now = new Date();
  const tickets = await queue
    .find(
      { status: 'waiting', expiresAt: { $gt: now } },
      { projection: { userId: 1, subject: 1, topic: 1, questionCount: 1, rating: 1, queuedAt: 1 } },
    )
    .sort({ queuedAt: 1 })
    .limit(scanLimit)
    .toArray();
  const buckets = groupEligibleTickets(tickets);
  const eligible = tickets.filter(ticket => canUseMatchmaking(ticket.userId));
  const claimed = new Set(), matches = [];
  let fallbackLookups = 0;
  for (const first of eligible) {
    if (matches.length >= maxMatches) break;
    if (claimed.has(first.userId)) continue;
    const candidates = (buckets.get(bucketKey(first)) || []).filter(
      other => other.userId !== first.userId && !claimed.has(other.userId) && canPairTickets(first, other, now),
    );
    if (!candidates.length && (tickets.length < scanLimit || fallbackLookups >= maxMatches)) continue;
    if (!await canContinue()) break;
    let matched = false;
    for (const candidate of candidates.slice(0, 3)) {
      const match = await pair(first, candidate);
      if (match) {
        claimed.add(first.userId);
        claimed.add(candidate.userId);
        matches.push(match);
        matched = true;
        break;
      }
    }
    if (!matched && tickets.length >= scanLimit && fallbackLookups < maxMatches) {
      fallbackLookups++;
      const range = getAllowedRatingRange(first.queuedAt, now);
      const second = await queue.findOne(
        { status: 'waiting', expiresAt: { $gt: now }, userId: { $nin: [first.userId, ...claimed] }, subject: first.subject, topic: first.topic, questionCount: first.questionCount, rating: { $gte: first.rating - range, $lte: first.rating + range } },
        { sort: { queuedAt: 1 } },
      );
      if (second && canUseMatchmaking(second.userId)) {
        const match = await pair(first, second);
        if (match) { claimed.add(first.userId); claimed.add(second.userId); matches.push(match); }
      }
    }
  }
  return matches;
}
export function emitMatchFound(match) {
  const io = getBattleRealtimeServer(); if (!io) return;
  for (const player of [match.first, match.second]) {
    const opponent = player.userId === match.first.userId ? match.second : match.first;
    io.to(`user:${player.userId}`).emit('matchmaking:matched', { roomCode: match.roomCode, matchmakingId: match.matchmakingId,
      opponent: { userId: opponent.userId, name: opponent.displayName, rating: opponent.rating }, ratingDifference: match.ratingDifference,
      subject: player.subject, topic: player.topic, questionCount: player.questionCount });
  }
}
