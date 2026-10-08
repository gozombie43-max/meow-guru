'use client';

import { getAuth, inMemoryPersistence, setPersistence, signInWithCustomToken, signOut, type Auth } from 'firebase/auth';
import api, { AUTH_TOKEN_CHANGED_EVENT, getAccessToken } from '@/lib/axios';
import { authSessionIdentity } from '@/lib/auth-session-identity';
import { getFirebaseApp, getFirebaseAppCheck } from './client';

let auth: Auth | undefined;
let authReady: Promise<void> | undefined;
let sessionGeneration = 0;
let inFlight: Promise<void> | undefined;
let authWork = Promise.resolve();

let identity = authSessionIdentity(getAccessToken());

function sessionChanged() {
  return Object.assign(new Error('The Meow session changed. Please try again.'), { code: 'auth/session-changed' });
}

// Load this module only when Gemini is used. Firebase credentials stay in memory
// and are cleared when Meow logs out or loses its session.
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, (event) => {
    const next = authSessionIdentity((event as CustomEvent<string | null>).detail);
    if (next !== null && next === identity) return;
    identity = next;
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
    const checkGeneration = () => { if (generation !== sessionGeneration) throw sessionChanged(); };
    const validateProject = (data: { uid: string; projectId: string }) => {
      checkGeneration();
      if (!data.uid || data.projectId !== app.options.projectId) {
        throw Object.assign(new Error('Firebase authentication configuration does not match.'), {
          code: 'auth/custom-token-mismatch',
        });
      }
    };
    // An existing Firebase credential does not prove the Meow session is active.
    // Validate it on every message, without minting/signing in again for that user.
    if (auth.currentUser) {
      const { data } = await api.post<{ uid: string; projectId: string }>(
        '/auth/firebase/session', {}, { timeout: 15000 },
      );
      validateProject(data);
      if (auth.currentUser.uid === data.uid) {
        try {
          await auth.currentUser.getIdToken();
          checkGeneration();
          return;
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code !== 'auth/user-token-expired' && code !== 'auth/invalid-user-token') throw error;
        }
      }
      await signOut(auth);
      checkGeneration();
    }
    const { data } = await api.post<{ token: string; uid: string; projectId: string }>(
      '/auth/firebase/token', {}, { timeout: 15000 },
    );
    validateProject(data);
    if (!data.token) throw Object.assign(new Error('Missing Firebase custom token.'), { code: 'auth/custom-token-mismatch' });
    const result = await signInWithCustomToken(auth, data.token);
    if (generation !== sessionGeneration || result.user.uid !== data.uid) {
      await signOut(auth);
      throw sessionChanged();
    }
    await result.user.getIdToken();
    checkGeneration();
  }).catch(async error => {
    const detail = error as { status?: number; response?: { status?: number } };
    const status = detail.status ?? detail.response?.status;
    if ((status === 401 || status === 403) && generation === sessionGeneration && auth) await signOut(auth);
    throw error;
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
