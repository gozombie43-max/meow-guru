import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { app, auth, user, getAuth, setPersistence, signInWithCustomToken, signOut, post, getFirebaseAppCheck } = vi.hoisted(() => {
  const user = { uid: 'meow-user', getIdToken: vi.fn() };
  return {
    app: { options: { projectId: 'meow-project' } }, auth: { currentUser: null as typeof user | null }, user,
    getAuth: vi.fn(), setPersistence: vi.fn(), signInWithCustomToken: vi.fn(),
    signOut: vi.fn(), post: vi.fn(), getFirebaseAppCheck: vi.fn(),
  };
});
vi.mock('firebase/auth', () => ({
  getAuth, setPersistence, signInWithCustomToken, signOut, inMemoryPersistence: 'memory',
}));
vi.mock('@/lib/axios', () => ({ default: { post }, AUTH_TOKEN_CHANGED_EVENT: 'auth-token-changed', getAccessToken: () => null }));
vi.mock('./client', () => ({ getFirebaseApp: () => app, getFirebaseAppCheck }));

let ensureFirebaseTutorAuth: () => Promise<void>;
const logout = () => window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: null }));

describe('Firebase tutor session', () => {
  beforeAll(async () => {
    ({ ensureFirebaseTutorAuth } = await import('./auth'));
  });
  beforeEach(async () => {
    logout();
    // Flush the serialized sign-out left by the preceding test.
    await Promise.resolve();
    await Promise.resolve();
    vi.clearAllMocks();
    getAuth.mockReturnValue(auth);
    setPersistence.mockResolvedValue(undefined);
    auth.currentUser = null;
    signOut.mockImplementation(async () => { auth.currentUser = null; });
    user.getIdToken.mockResolvedValue('firebase-id-token');
    signInWithCustomToken.mockImplementation(async () => { auth.currentUser = user; return { user }; });
    post.mockResolvedValue({ data: { token: 'custom-token', uid: user.uid, projectId: 'meow-project' } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('validates Meow authentication and completes Firebase sign-in before generation', async () => {
    await ensureFirebaseTutorAuth();
    expect(setPersistence).toHaveBeenCalledWith(auth, 'memory');
    expect(getFirebaseAppCheck).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith('/auth/firebase/token', {}, { timeout: 15000 });
    expect(signInWithCustomToken).toHaveBeenCalledWith(auth, 'custom-token');
    expect(user.getIdToken).toHaveBeenCalledOnce();
  });
  it('coalesces concurrent requests but validates Meow again for the next message', async () => {
    await Promise.all([ensureFirebaseTutorAuth(), ensureFirebaseTutorAuth()]);
    expect(post).toHaveBeenCalledOnce();
    await ensureFirebaseTutorAuth();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith('/auth/firebase/session', {}, { timeout: 15000 });
    expect(signInWithCustomToken).toHaveBeenCalledOnce();
  });
  it('reuses Firebase credentials only after successful Meow validation', async () => {
    await ensureFirebaseTutorAuth();
    post.mockRejectedValueOnce(Object.assign(new Error('revoked'), { status: 401 }));
    await expect(ensureFirebaseTutorAuth()).rejects.toMatchObject({ status: 401 });
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(auth.currentUser).toBeNull();
    expect(signInWithCustomToken).toHaveBeenCalledOnce();
  });
  it('signs in again when the validated user differs from the Firebase user', async () => {
    await ensureFirebaseTutorAuth();
    auth.currentUser = { ...user, uid: 'old-user' };
    await ensureFirebaseTutorAuth();
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(signInWithCustomToken).toHaveBeenCalledTimes(2);
    expect(auth.currentUser?.uid).toBe(user.uid);
  });
  it('recovers an invalid Firebase credential with one new custom sign-in', async () => {
    await ensureFirebaseTutorAuth();
    user.getIdToken.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'auth/user-token-expired' }));
    await ensureFirebaseTutorAuth();
    expect(signInWithCustomToken).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledTimes(3);
  });
  it('blocks a pending message on a different Meow session', async () => {
    await ensureFirebaseTutorAuth();
    let deliver!: (value: unknown) => void;
    post.mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
    const pending = ensureFirebaseTutorAuth();
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: 'new-session-token' }));
    deliver({ data: { uid: user.uid, projectId: 'meow-project' } });
    await expect(pending).rejects.toMatchObject({ code: 'auth/session-changed' });
  });
  it('keeps a pending validation and Firebase sign-in across same-session token rotation', async () => {
    const token = (jti: string) => `header.${btoa(JSON.stringify({ id: user.uid, sid: 'same-session', jti }))}.signature`;
    window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: token('first') }));
    await ensureFirebaseTutorAuth();
    let deliver!: (value: unknown) => void;
    post.mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
    const pending = ensureFirebaseTutorAuth();
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: token('rotated') }));
    deliver({ data: { uid: user.uid, projectId: 'meow-project' } });
    await expect(pending).resolves.toBeUndefined();
    expect(signInWithCustomToken).toHaveBeenCalledOnce();
  });
  it('rejects mismatched Firebase projects before signing in', async () => {
    post.mockResolvedValueOnce({ data: { token: 'custom-token', uid: user.uid, projectId: 'other-project' } });
    await expect(ensureFirebaseTutorAuth()).rejects.toMatchObject({ code: 'auth/custom-token-mismatch' });
    expect(signInWithCustomToken).not.toHaveBeenCalled();
  });
  it('never signs in after the Meow session has been rejected', async () => {
    post.mockRejectedValueOnce(Object.assign(new Error('unauthenticated'), { status: 401 }));
    await expect(ensureFirebaseTutorAuth()).rejects.toMatchObject({ status: 401 });
    expect(signInWithCustomToken).not.toHaveBeenCalled();
    await expect(ensureFirebaseTutorAuth()).resolves.toBeUndefined();
  });
  it('blocks an in-flight token response after logout', async () => {
    let deliverToken!: (value: unknown) => void;
    post.mockImplementationOnce(() => new Promise(resolve => { deliverToken = resolve; }));
    const pending = ensureFirebaseTutorAuth();
    await vi.waitFor(() => expect(post).toHaveBeenCalledOnce());
    logout();
    deliverToken({ data: { token: 'custom-token', uid: user.uid, projectId: 'meow-project' } });
    await expect(pending).rejects.toMatchObject({ code: 'auth/session-changed' });
    expect(signInWithCustomToken).not.toHaveBeenCalled();
    await ensureFirebaseTutorAuth();
    expect(signOut).toHaveBeenCalled();
  });
  it('clears a sign-in that finishes after logout', async () => {
    let finishSignIn!: (value: unknown) => void;
    signInWithCustomToken.mockImplementationOnce(() => new Promise(resolve => { finishSignIn = resolve; }));
    const pending = ensureFirebaseTutorAuth();
    await vi.waitFor(() => expect(signInWithCustomToken).toHaveBeenCalledOnce());
    logout();
    finishSignIn({ user });
    await expect(pending).rejects.toMatchObject({ code: 'auth/session-changed' });
    expect(signOut).toHaveBeenCalled();
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});
