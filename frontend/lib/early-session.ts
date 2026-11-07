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

type EarlyRouteEntry = {
  token: string | null;
  promise: Promise<unknown | undefined>;
};

type EarlyRouteBootstrap = {
  base: string;
  expiresAt: number;
  cancelled: boolean;
  entries: Record<string, EarlyRouteEntry>;
  cancel: () => void;
};

declare global {
  interface Window {
    __MEOW_SESSION_BOOTSTRAP__?: EarlySession;
    __MEOW_ROUTE_BOOTSTRAP__?: EarlyRouteBootstrap;
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

  let routeController: AbortController | null = null;
  let routeTimeout: number | undefined;
  let routeState: EarlyRouteBootstrap | null = null;
  const ensureRouteState = () => {
    if (routeState) return routeState;
    routeController = new browser.AbortController();
    const created: EarlyRouteBootstrap = {
      base, expiresAt: Date.now() + 15_000, cancelled: false, entries: {},
      cancel: () => {
        created.cancelled = true;
        routeController?.abort();
        if (routeTimeout !== undefined) browser.clearTimeout(routeTimeout);
        if (browser.__MEOW_ROUTE_BOOTSTRAP__ === created) delete browser.__MEOW_ROUTE_BOOTSTRAP__;
      },
    };
    routeTimeout = browser.setTimeout(created.cancel, 15_000);
    browser.__MEOW_ROUTE_BOOTSTRAP__ = created;
    routeState = created;
    return created;
  };
  const preloadJson = (
    key: string,
    url: string,
    init: RequestInit,
    entryToken: string | null,
    transform?: (data: unknown) => unknown,
  ) => {
    const rs = ensureRouteState();
    if (rs.cancelled || rs.entries[key] || !routeController) return;
    rs.entries[key] = {
      token: entryToken,
      promise: browser.fetch(url, { ...init, signal: routeController.signal })
        .then(async response => {
          if (!response.ok || rs.cancelled) return undefined;
          const json: unknown = await response.json();
          return rs.cancelled ? undefined : (transform ? transform(json) : json);
        })
        .catch(() => undefined),
    };
  };

  const loc = browser.location;
  const pathname = loc && typeof loc.pathname === 'string' ? loc.pathname : '';
  const searchParams = pathname && typeof URLSearchParams === 'function'
    ? new URLSearchParams(loc.search || '')
    : null;
  const quizMatch = pathname.match(/^\/(mathematics|english|reasoning|general-awareness)\/(?:(?:arithmetic|advance)\/)?([^/]+)\/quiz$/);
  const trainingMatch = pathname.match(/^\/play\/session\/([^/]+)$/);
  const mockMatch = pathname.match(/^\/mock-test\/([^/]+)\/([^/]+)\/attempt$/);

  if (quizMatch && searchParams) {
    const subject = quizMatch[1];
    let topic = quizMatch[2];
    try { topic = decodeURIComponent(topic); } catch { /* keep raw */ }
    const rawMode = searchParams.get('mode') || '';
    const mode = ['formula', 'mixed', 'ai-challenge', 'easy', 'hard'].includes(rawMode) ? rawMode : 'concept';
    const metaQuery = new URLSearchParams();
    metaQuery.set('topic', topic);
    metaQuery.set('subject', subject);
    metaQuery.set('mode', mode);
    const metaUrl = `${base}/api/questions/meta?${metaQuery.toString()}`;
    preloadJson(`public:GET:${metaUrl}`, metaUrl, { credentials: 'omit' }, null);
    if (searchParams.get('resume') !== '1' && !searchParams.get('letter')) {
      const q = new URLSearchParams();
      q.set('subject', subject);
      q.set('topic', topic);
      q.set('mode', mode);
      q.set('limit', '100');
      q.set('includeTotal', 'false');
      const sUrl = `${base}/api/questions/session?${q.toString()}`;
      preloadJson(`public:GET:${sUrl}`, sUrl, { credentials: 'omit' }, null);
    }
  }

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
    if (trainingMatch) {
      let sessionId = trainingMatch[1];
      try { sessionId = decodeURIComponent(sessionId); } catch { /* keep raw */ }
      const sessionUrl = `${base}/api/training/sessions/${encodeURIComponent(sessionId)}`;
      preloadJson(`auth:GET:${sessionUrl}`, sessionUrl, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
      }, token);
    } else if (mockMatch && searchParams) {
      let examSlug = mockMatch[1];
      let testId = mockMatch[2];
      try { examSlug = decodeURIComponent(examSlug); testId = decodeURIComponent(testId); } catch { /* keep raw */ }
      const resumeId = searchParams.get('resume');
      if (resumeId) {
        const attemptUrl = `${base}/api/mocktest/attempt/${encodeURIComponent(resumeId)}`;
        preloadJson(`auth:GET:${attemptUrl}`, attemptUrl, {
          headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
        }, token);
      } else {
        try {
          const parts = token.split('.');
          const decoded = parts.length === 3 && browser.atob
            ? JSON.parse(browser.atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { id?: unknown }
            : null;
          const owner = typeof decoded?.id === 'string' && decoded.id ? decoded.id : null;
          if (owner && browser.sessionStorage && browser.crypto?.randomUUID) {
            const storageKey = `mock-start:${JSON.stringify([owner, examSlug, testId])}`;
            let startKey = browser.sessionStorage.getItem(storageKey);
            if (!startKey) {
              startKey = browser.crypto.randomUUID();
              browser.sessionStorage.setItem(storageKey, startKey);
            }
            const startUrl = `${base}/api/mocktest/${examSlug}/${testId}/start`;
            preloadJson(`auth:POST:${startUrl}`, startUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'Idempotency-Key': startKey,
              },
              credentials: 'include',
            }, token);
          }
        } catch { /* fallback to runtime startTest */ }
      }
    }
    // This is the same verified profile read AuthContext normally starts later.
    state.profile = browser.fetch(`${base}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'include', signal: controller.signal,
    }).then(async response => {
      if (!response.ok || state.cancelled) return undefined;
      const profile: unknown = await response.json();
      const validProfile = profile && typeof profile === 'object' && typeof (profile as { id?: unknown }).id === 'string'
        ? profile : undefined;
      if (validProfile && quizMatch && searchParams && searchParams.get('resume') === '1') {
        const subject = quizMatch[1];
        let topic = quizMatch[2];
        try { topic = decodeURIComponent(topic); } catch { /* keep raw */ }
        const rawMode = searchParams.get('mode') || '';
        const mode = ['formula', 'mixed', 'ai-challenge', 'easy', 'hard'].includes(rawMode) ? rawMode : 'concept';
        const quizKey = `${subject}:${topic}`;
        const recent = (validProfile as { recentQuizzes?: Array<{
          quizKey?: string; status?: string; currentIndex?: number; questionAnchor?: string;
          selectedAnswers?: unknown; sessionFilters?: { exam?: string; concept?: string; letter?: string };
        }> }).recentQuizzes;
        const entry = Array.isArray(recent)
          ? recent.find(e => e && e.quizKey === quizKey && e.status !== 'completed')
          : undefined;
        if (entry && !entry.selectedAnswers) {
          const detailUrl = `${base}/users/me/recent-quizzes/${encodeURIComponent(quizKey)}`;
          preloadJson(`auth:GET:${detailUrl}`, detailUrl, {
            headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
          }, token, d => (d && typeof d === 'object' ? (d as { quiz?: unknown }).quiz : undefined));
        }
        const filters = entry?.sessionFilters;
        if (!filters?.exam && !filters?.concept && !filters?.letter && !searchParams.get('letter')) {
          const q = new URLSearchParams();
          q.set('subject', subject);
          q.set('topic', topic);
          q.set('mode', mode);
          if (entry?.questionAnchor) q.set('anchor', entry.questionAnchor);
          if (entry?.currentIndex !== undefined) q.set('resumeIndex', String(entry.currentIndex));
          q.set('limit', '100');
          q.set('includeTotal', 'false');
          const sUrl = `${base}/api/questions/session?${q.toString()}`;
          preloadJson(`public:GET:${sUrl}`, sUrl, { credentials: 'omit' }, null);
        }
      }
      return validProfile;
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

export function consumeEarlyRouteData<T = unknown>(
  base: string,
  key: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<T | undefined> | null {
  if (typeof window === 'undefined') return null;
  const rs = window.__MEOW_ROUTE_BOOTSTRAP__;
  if (!rs) return null;
  if (rs.base !== base || rs.cancelled || rs.expiresAt <= Date.now()) {
    rs.cancel();
    return null;
  }
  const entry = rs.entries[key];
  if (!entry) return null;
  if (entry.token !== null && entry.token !== token) {
    delete rs.entries[key];
    return null;
  }
  if (signal?.aborted) return null;
  return entry.promise.then(value => {
    if (signal?.aborted || rs.cancelled) return undefined;
    delete rs.entries[key];
    return value as T | undefined;
  });
}

export function discardEarlySession() {
  if (typeof window === 'undefined') return;
  window.__MEOW_SESSION_BOOTSTRAP__?.cancel();
  window.__MEOW_ROUTE_BOOTSTRAP__?.cancel();
}
