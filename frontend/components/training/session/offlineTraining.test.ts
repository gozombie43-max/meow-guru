import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { clearPendingTrainingAction, readPendingTrainingAction, readTrainingSnapshot, savePendingTrainingAction, saveTrainingSnapshot } from './offlineTraining';
import type { TrainingSession } from '../training-types';
it('isolates users, preserves the newest revision and prevents pending action replacement', async () => {
  const snapshot = { id: 'session', revision: 2 } as TrainingSession;
  await saveTrainingSnapshot('one', snapshot);
  await saveTrainingSnapshot('one', { ...snapshot, revision: 1 });
  expect((await readTrainingSnapshot('one', 'session'))?.revision).toBe(2);
  expect(await readTrainingSnapshot('two', 'session')).toBeNull();
  const pending = { key: 'action-123', body: { type: 'finish' as const, revision: 2 }, expiresAt: Date.now() + 1000 };
  await savePendingTrainingAction('one', 'session', pending);
  await expect(savePendingTrainingAction('one', 'session', { ...pending, key: 'action-456' })).rejects.toThrow('awaiting synchronization');
  await clearPendingTrainingAction('one', 'session', 'wrong-key');
  expect((await readPendingTrainingAction('one', 'session'))?.key).toBe(pending.key);
  await clearPendingTrainingAction('one', 'session', pending.key);
  expect(await readPendingTrainingAction('one', 'session')).toBeNull();
});
