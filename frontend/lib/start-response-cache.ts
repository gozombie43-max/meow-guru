'use client';

import { AUTH_TOKEN_CHANGED_EVENT, getAccessToken } from '@/lib/axios';

import { authSessionIdentity } from './auth-session-identity';

let identity = authSessionIdentity(getAccessToken());
let epoch = 0;
export const startResponseEpoch = () => epoch;

// Bridge a successful create response to its next screen, without persisting it.
const entries = new Map<string, { data: unknown; receivedAt: number }>();
const MAX_AGE = 30_000;
const key = (kind: string, owner: string, id: string) => JSON.stringify([kind, owner, id]);

export function seedStartResponse<T>(kind: string, owner: string | undefined, id: string, data: T, startedAtEpoch = epoch) {
  if (!owner || startedAtEpoch !== epoch) return;
  for (const [entryKey, entry] of entries) {
    if (Date.now() - entry.receivedAt >= MAX_AGE) entries.delete(entryKey);
  }
  if (entries.size >= 20) entries.delete(entries.keys().next().value!);
  entries.set(key(kind, owner, id), { data, receivedAt: Date.now() });
}

export function readStartResponse<T>(kind: string, owner: string | undefined, id: string) {
  if (!owner) return;
  const entryKey = key(kind, owner, id);
  const entry = entries.get(entryKey);
  if (!entry) return;
  if (Date.now() - entry.receivedAt >= MAX_AGE) {
    entries.delete(entryKey);
    return;
  }
  return { data: entry.data as T, receivedAt: entry.receivedAt };
}

export function clearStartResponse(kind: string, owner: string | undefined, id: string) {
  if (owner) entries.delete(key(kind, owner, id));
}

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, (event) => {
    const next = authSessionIdentity((event as CustomEvent<string | null>).detail);
    if (next !== null && next === identity) return;
    identity = next;
    epoch += 1;
    entries.clear();
  });
}
