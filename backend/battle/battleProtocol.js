import { randomInt } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const battleCodePattern = /^(?:[A-Z2-9]{6}|\d{4})$/;
export const normalizeBattleCode = value => String(value ?? '').trim().toUpperCase();
export const generateBattleCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
export const isRoundClosed = room => room?.players?.length === 2 && room.players.every(player => player.answered);

// Scores include only completed rounds until both current answers are locked.
// This same projection protects broadcasts, reconnects and other public reads.
export function publicBattleScores(room) {
  const closed = room?.status === 'finished' || isRoundClosed(room);
  return Object.fromEntries((room?.players || []).map(player => [player.userId, {
    name: player.name,
    score: Math.max(0, (player.score || 0) - (!closed && player.answered ? player.roundPoints ?? (player.lastCorrect === true ? 10 : 0) : 0)),
    answered: Boolean(player.answered),
    connected: player.connected !== false,
    ...(closed ? { lastCorrect: player.lastCorrect ?? null } : {}),
  }]));
}
