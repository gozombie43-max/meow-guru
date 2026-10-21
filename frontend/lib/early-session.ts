type EarlySession = {
  base: string;
  expiresAt: number;
  token: string | null;
  refreshConsumed: boolean;
  profileConsumed: boolean;
  cancelled: boolean;
  refresh: Promise<string | null>;
  profile: Promise<unknown | undefined>;
  cancel: () => void;
};

declare global {
  interface Window {
    __MEOW_SESSION_BOOTSTRAP__?: EarlySession;
  }
}

// Keep this function self-contained: its source runs before framework hydration.
function startEarlySession(base: string) {
  const browser = window;
  if (browser.__MEOW_SESSION_BOOTSTRAP__ || !browser.fetch || !browser.AbortController) return;
  const controller = new browser.AbortController();
  const state: EarlySession = {
    base, expiresAt: Date.now() + 15_000, token: null,
    refreshConsumed: false, profileConsumed: false, cancelled: false,
    refresh: Promise.resolve(null), profile: Promise.resolve(undefined),
    cancel: () => {
      state.cancelled = true;
      controller.abort();
      browser.clearTimeout(timeout);
      if (browser.__MEOW_SESSION_BOOTSTRAP__ === state) delete browser.__MEOW_SESSION_BOOTSTRAP__;
    },
  };
  browser.__MEOW_SESSION_BOOTSTRAP__ = state;
  const timeout = browser.setTimeout(state.cancel, 15_000);
  const refresh = async () => {
    const response = await browser.fetch(`${base}/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      credentials: 'include', signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.token === 'string' ? data.token : null;
  };
  state.refresh = Promise.resolve().then(() => browser.navigator.locks
    ? browser.navigator.locks.request('meow-session-refresh', { signal: controller.signal }, refresh)
    : refresh()).catch(() => null).then(token => {
    if (state.cancelled || !token) return null;
    state.token = token;
    // This is the same verified profile read AuthContext normally starts later.
    state.profile = browser.fetch(`${base}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'include', signal: controller.signal,
    }).then(async response => {
      if (!response.ok || state.cancelled) return undefined;
      const profile: unknown = await response.json();
      return profile && typeof profile === 'object' && typeof (profile as { id?: unknown }).id === 'string'
        ? profile : undefined;
    }).catch(() => undefined);
    return token;
  });
}

export function earlySessionScript(base: string) {
  return `(${startEarlySession.toString()})(${JSON.stringify(base).replace(/</g, '\\u003c')});`;
}

function pendingSession(base: string) {
  if (typeof window === 'undefined') return null;
  const state = window.__MEOW_SESSION_BOOTSTRAP__;
  if (!state) return null;
  if (state.base !== base || state.cancelled || state.expiresAt <= Date.now()) {
    state.cancel();
    return null;
  }
  return state;
}

export function consumeEarlyRefresh(base: string) {
  const state = pendingSession(base);
  if (!state || state.refreshConsumed) return null;
  state.refreshConsumed = true;
  return state.refresh.then(token => {
    if (state.cancelled) return null;
    if (!token) state.cancel();
    return token;
  });
}

export function consumeEarlyProfile(base: string, token: string, signal: AbortSignal) {
  const state = pendingSession(base);
  if (!state || state.profileConsumed) return null;
  if (state.token !== token) {
    state.cancel();
    return null;
  }
  state.profileConsumed = true;
  if (signal.aborted) state.cancel();
  else signal.addEventListener('abort', state.cancel, { once: true });
  return state.profile.then(profile => state.cancelled ? undefined : profile).finally(() => {
    signal.removeEventListener('abort', state.cancel);
    state.cancel();
  });
}

export function discardEarlySession() {
  if (typeof window !== 'undefined') window.__MEOW_SESSION_BOOTSTRAP__?.cancel();
}
