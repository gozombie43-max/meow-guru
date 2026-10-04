'use client';

import { getAuth, inMemoryPersistence, setPersistence, signInWithCustomToken, signOut, type Auth } from 'firebase/auth';
import api, { AUTH_TOKEN_CHANGED_EVENT } from '@/lib/axios';
import { getFirebaseApp, getFirebaseAppCheck } from './client';

let auth: Auth | undefined;
let authReady: Promise<void> | undefined;
let sessionGeneration = 0;
let inFlight: Promise<void> | undefined;
let authWork = Promise.resolve();

function sessionChanged() {
  return Object.assign(new Error('The Meow session changed. Please try again.'), { code: 'auth/session-changed' });
}

// Load this module only when Gemini is used. Firebase credentials stay in memory
// and are cleared when Meow logs out or loses its session.
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, (event) => {
    if ((event as CustomEvent<string | null>).detail !== null) return;
    sessionGeneration += 1;
    inFlight = undefined;
    authWork = authWork.then(async () => { if (auth) await signOut(auth); }).catch(() => {});
  });
}

export async function ensureFirebaseTutorAuth(): Promise<void> {
  if (inFlight) return inFlight;
  const generation = sessionGeneration;
  const pending = authWork.then(async () => {
    const app = getFirebaseApp();
    getFirebaseAppCheck();
    if (!auth) {
      auth = getAuth(app);
      authReady = setPersistence(auth, inMemoryPersistence);
    }
    await authReady;
    // Revalidate the Meow session for every message, including after reloads.
    const { data } = await api.post<{ token: string; uid: string; projectId: string }>(
      '/auth/firebase/token', {}, { timeout: 15000 },
    );
    if (generation !== sessionGeneration) throw sessionChanged();
    if (!data.token || !data.uid || data.projectId !== app.options.projectId) {
      throw Object.assign(new Error('Firebase authentication configuration does not match.'), {
        code: 'auth/custom-token-mismatch',
      });
    }
    const result = await signInWithCustomToken(auth, data.token);
    if (generation !== sessionGeneration || result.user.uid !== data.uid) {
      await signOut(auth);
      throw sessionChanged();
    }
    await result.user.getIdToken();
    if (generation !== sessionGeneration) throw sessionChanged();
  });
  inFlight = pending;
  // Serialize sign-in and sign-out so an old request cannot replace a new user.
  authWork = pending.catch(() => {});
  try {
    await pending;
  } finally {
    if (inFlight === pending) inFlight = undefined;
  }
}
