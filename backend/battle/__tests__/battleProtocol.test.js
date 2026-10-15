import { describe, expect, it } from 'vitest';
import { publicBattleScores, generateBattleCode, battleCodePattern } from '../battleProtocol.js';
import { battlePolicy, isRatedBattle } from '../battlePolicy.js';

describe('Battle public protocol', () => {
  it.each([true, false])('hides a first answer and score delta, correct=%s', correct => {
    const room = { status: 'active', players: [
      { userId: 'a', name: 'A', score: correct ? 30 : 20, answered: true, lastCorrect: correct, selectedIndex: 2, answerLog: [{ correct }] },
      { userId: 'b', name: 'B', score: 10, answered: false },
    ] };
    const result = publicBattleScores(room);
    expect(result.a).toEqual({ name: 'A', score: 20, answered: true, connected: true });
    expect(JSON.stringify(result)).not.toMatch(/selectedIndex|lastCorrect|answerLog/);
    room.players[1].answered = true;
    expect(publicBattleScores(room).a.score).toBe(correct ? 30 : 20);
  });
  it('generates six-character cryptographic room codes and accepts existing room codes during rollout', () => {
    const codes = new Set(Array.from({ length: 100 }, generateBattleCode));
    expect(codes.size).toBe(100);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(battleCodePattern.test('4821')).toBe(true);
    expect(battleCodePattern.test('123')).toBe(false);
    expect(battleCodePattern.test('ABCDEF extra')).toBe(false);
  });
  it.each(['private', 'social', 'rematch'])('keeps %s battles casual', origin => {
    expect(battlePolicy(origin)).toEqual({ origin, mode: 'casual', rated: false });
    expect(isRatedBattle({ origin, mode: 'ranked', rated: true, matchmakingId: 'spoofed' })).toBe(false);
  });
  it('honors the ranked kill switch during room creation and settlement', () => {
    const previous = process.env.BATTLE_RANKED_ENABLED;
    try {
      process.env.BATTLE_RANKED_ENABLED = 'false';
      expect(battlePolicy('matchmaking').rated).toBe(false);
      expect(isRatedBattle({ origin: 'matchmaking', mode: 'ranked', rated: true, matchmakingId: 'm' })).toBe(false);
    } finally { if (previous === undefined) delete process.env.BATTLE_RANKED_ENABLED; else process.env.BATTLE_RANKED_ENABLED = previous; }
    expect(isRatedBattle({ matchmakingId: 'legacy' })).toBe(false);
  });
});
