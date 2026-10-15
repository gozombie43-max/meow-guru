import { expect, it } from 'vitest';
import { battleAnswerKey, normalizeBattleAnswer, gradeBattleAnswer, publicBattleQuestion } from '../battleAnswers.js';
import { publicBattleScores } from '../battleProtocol.js';
import { battleQuestionMetadata } from '../../services/questions/battleQuestionMetadata.js';
import { battleDecision } from '../battleOutcome.js';
const options = ['A text', 'B text', 'C text', 'D text'];
it('grades MSQ as an exact set by default, rejects duplicates, wrong kinds and indices', () => {
  const question = { questionType: 'MSQ', options, correctAnswer: ['A', 'C'] };
  const answer = normalizeBattleAnswer(question, { type: 'msq', selectedIndices: [2, 0] });
  expect(answer.selectedIndices).toEqual([0, 2]);
  expect(gradeBattleAnswer(question, answer)).toEqual({ correct: true, points: 10 });
  expect(gradeBattleAnswer(question, { type: 'msq', selectedIndices: [0] })).toEqual({ correct: false, points: 0 });
  for (const input of [{ type: 'mcq', selectedIndex: 0 }, { type: 'msq', selectedIndices: [0, 0] }, { type: 'msq', selectedIndices: [] }, { type: 'msq', selectedIndices: [4] }]) expect(normalizeBattleAnswer(question, input)).toBeNull();
  expect(gradeBattleAnswer({ ...question, partialCredit: true }, { type: 'msq', selectedIndices: [0] })).toEqual({ correct: false, points: 5 });
  expect(gradeBattleAnswer({ ...question, partialCredit: true }, { type: 'msq', selectedIndices: [0, 1] }).points).toBe(0);
});
it('grades finite NAT values, inclusive ranges, zero, negative values and explicit tolerance', () => {
  const question = { questionType: 'NAT', correctAnswer: { min: -2, max: 0 } };
  for (const numericAnswer of [-2, 0]) expect(gradeBattleAnswer(question, normalizeBattleAnswer(question, { type: 'nat', numericAnswer })).correct).toBe(true);
  expect(gradeBattleAnswer(question, { type: 'nat', numericAnswer: .001 }).correct).toBe(false);
  expect(gradeBattleAnswer({ questionType: 'NAT', correctAnswer: 10, numericTolerance: .5 }, { type: 'nat', numericAnswer: 10.5 }).correct).toBe(true);
  for (const numericAnswer of ['', '0', null, Infinity, NaN]) expect(normalizeBattleAnswer(question, { type: 'nat', numericAnswer })).toBeNull();
  expect(battleAnswerKey({ questionType: 'NAT', correctAnswer: { min: 2, max: 1 } })).toBeNull();
});
it('keeps explicit media and question kind public while withholding every grading secret', () => {
  const question = { questionUid: 'jam', question: 'Diagram', questionType: 'MSQ', options, correctAnswer: [0, 2], numericTolerance: 99,
    questionImage: '/q.png', optionAImage: '/a.png', optionImages: [null, '/b.png'], rankedEligible: true, difficulty: 'hard', concept: 'waves' };
  const result = publicBattleQuestion(question);
  expect(result).toMatchObject({ type: 'msq', questionImage: '/q.png', optionImages: ['/a.png', '/b.png', null, null] });
  expect(result).not.toHaveProperty('correctAnswer'); expect(result).not.toHaveProperty('numericTolerance');
  expect(battleQuestionMetadata(question)).toMatchObject({ battleEligible: true, rankedEligible: true, battleMedia: 'image' });
  expect(battleQuestionMetadata({ ...question, questionType: 'NAT', options: [], correctAnswer: { min: 1, max: 2 } }).rankedEligible).toBe(true);
});
it('withholds partial points until both players have locked their answers', () => {
  const room = { players: [{ userId: 'a', score: 15, answered: true, roundPoints: 5, lastCorrect: false }, { userId: 'b', score: 10, answered: false }] };
  expect(publicBattleScores(room).a.score).toBe(10);
  room.players[1].answered = true; expect(publicBattleScores(room).a.score).toBe(15);
});
it('uses total server response time only after a ranked score tie, and keeps casual draws', () => {
  const room = { mode: 'ranked', questionCount: 1, players: [{ userId: 'a', score: 10, answerLog: [{ questionIndex: 0, responseTimeMs: 2000 }] }, { userId: 'b', score: 10, answerLog: [{ questionIndex: 0, responseTimeMs: 3000 }] }] };
  expect(battleDecision(room)).toMatchObject({ winnerUserId: 'a', outcomeReason: 'response-time' });
  expect(battleDecision({ ...room, mode: 'casual' }).winnerUserId).toBeNull();
  room.players[1].score = 20; expect(battleDecision(room)).toMatchObject({ winnerUserId: 'b', outcomeReason: 'score' });
  room.players[1].score = 10; room.players[0].answerLog = []; expect(battleDecision(room).winnerUserId).toBeNull();
});
