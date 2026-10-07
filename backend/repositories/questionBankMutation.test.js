import { expect, it, vi } from 'vitest';
import { mutateQuestionBank } from './questionBankMutation.js';

it('retires the question generation even after a partially successful import throws', async () => {
  const updateOne = vi.fn(async () => {});
  const db = { collection: vi.fn(() => ({ updateOne })) };
  await expect(mutateQuestionBank(db, async () => { throw new Error('partial import'); })).rejects.toThrow('partial import');
  expect(db.collection).toHaveBeenCalledWith('questionMetadata');
  expect(updateOne).toHaveBeenCalledWith({ _id: 'revision' }, { $inc: { revision: 1 } }, { upsert: true });
});
