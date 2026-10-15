import { describe, expect, it, vi } from 'vitest';
import { battleQuestionMetadata } from '../../services/questions/battleQuestionMetadata.js';
import { backfillBattleMetadata } from '../../services/questions/battleMetadataBackfill.js';

const question = { _id: 'id', questionUid: 'q1', question: 'Which option?', options: ['A', 'B', 'C', 'D'], correctAnswer: 0,
  concept: 'Algebra', difficulty: 'medium', language: 'English', exam: 'SSC CGL 2024' };

describe('ranked certification and metadata migration', () => {
  it('never promotes a technically playable question without explicit certification', () => {
    expect(battleQuestionMetadata(question)).toMatchObject({ battleEligible: true, rankedEligible: false, battleLanguage: 'en', battleExamKey: 'ssccgl2024', battleYear: '2024' });
    expect(battleQuestionMetadata({ ...question, rankedEligible: true }).rankedEligible).toBe(true);
    expect(battleQuestionMetadata({ ...question, rankedEligible: true, difficulty: 'unknown' }).rankedEligible).toBe(false);
    expect(battleQuestionMetadata({ ...question, rankedEligible: true, options: ['A', 'A', 'C', 'D'] }).rankedEligible).toBe(false);
    expect(battleQuestionMetadata({ ...question, question: '![diagram](/image.png)' }).battleMedia).toBe('image');
  });
  it('previews without writes and guards every source field against concurrent edits on apply', async () => {
    const cursor = { async *[Symbol.asyncIterator]() { yield question; } };
    const bulkWrite = vi.fn().mockResolvedValue({ modifiedCount: 0, matchedCount: 0 });
    const collection = { find: () => ({ batchSize: () => cursor }), bulkWrite };
    expect(await backfillBattleMetadata(collection)).toMatchObject({ candidates: 1, modified: 0, rankedEligible: 0 });
    expect(bulkWrite).not.toHaveBeenCalled();
    expect(await backfillBattleMetadata(collection, { apply: true })).toMatchObject({ candidates: 1, conflicts: 1 });
    expect(bulkWrite.mock.calls[0][0][0].updateOne).toMatchObject({ filter: { questionUid: { $eq: 'q1' }, rankedEligible: { $exists: false } }, update: { $set: { rankedEligible: false } } });
  });
});
