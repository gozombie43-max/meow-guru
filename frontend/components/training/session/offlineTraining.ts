import type { TrainingAction, TrainingSession } from '../training-types';

export type PendingTrainingAction = { key: string; body: TrainingAction & { revision: number }; expiresAt: number };
let opening: Promise<IDBDatabase> | undefined;
function database() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('meow-training-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('recovery');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = undefined; reject(request.error); };
  });
  return opening;
}
const scope = (userId: string, id: string, type: string) => JSON.stringify([userId, id, type]);
async function read<T>(key: string): Promise<T | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('recovery').objectStore('recovery').get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
async function mutate(key: string, update: (value: unknown) => unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('recovery', 'readwrite');
    const store = transaction.objectStore('recovery');
    const request = store.get(key);
    let error: unknown;
    request.onsuccess = () => {
      try { const value = update(request.result); if (value === null) store.delete(key); else store.put(value, key); }
      catch (cause) { error = cause; transaction.abort(); }
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(error || transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
export const offlineTrainingEnabled = () => process.env.NEXT_PUBLIC_OFFLINE_TRAINING === 'true';
export async function saveTrainingSnapshot(userId: string, session: TrainingSession) {
  await mutate(scope(userId, session.id, 'snapshot'), old => {
    const previous = old as { session?: TrainingSession } | undefined;
    if (previous?.session && previous.session.revision > session.revision) return previous;
    return { session, expiresAt: Date.now() + 86400000 };
  });
}
export async function readTrainingSnapshot(userId: string, id: string) {
  const value = await read<{ session: TrainingSession; expiresAt: number }>(scope(userId, id, 'snapshot'));
  return value && value.expiresAt > Date.now() && value.session.id === id ? value.session : null;
}
export async function readPendingTrainingAction(userId: string, id: string) {
  const value = await read<PendingTrainingAction>(scope(userId, id, 'pending'));
  return value && value.expiresAt > Date.now() ? value : null;
}
export async function savePendingTrainingAction(userId: string, id: string, action: PendingTrainingAction) {
  await mutate(scope(userId, id, 'pending'), old => {
    const previous = old as PendingTrainingAction | undefined;
    if (previous && previous.expiresAt > Date.now() && previous.key !== action.key) throw new Error('A saved action is awaiting synchronization. Reconnect and reload before continuing.');
    return action;
  });
}
export async function clearPendingTrainingAction(userId: string, id: string, key: string) {
  await mutate(scope(userId, id, 'pending'), old => (old as PendingTrainingAction | undefined)?.key === key ? null : old);
}
