// @vitest-environment node
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeEarlyProfile, consumeEarlyRefresh, discardEarlySession, earlySessionScript } from './early-session';

const base = '/backend-api';
const profile = { id: 'student', name: 'Student', email: 'student@example.test' };
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const fetch = vi.fn().mockResolvedValueOnce(response({ token: 'server-token' })).mockResolvedValue(response(profile));
  const requestLock = vi.fn((_name: string, _options: LockOptions, run: () => unknown) => run());
  const browser = {
    fetch, navigator: { locks: { request: requestLock } }, AbortController,
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    __MEOW_SESSION_BOOTSTRAP__: undefined as Window['__MEOW_SESSION_BOOTSTRAP__'],
  };
  vi.stubGlobal('window', browser);
  const start = () => vm.runInNewContext(earlySessionScript(base), { window: browser, Date });
  return { fetch, requestLock, browser, start };
}

afterEach(() => {
  discardEarlySession();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('HTML session bootstrap', () => {
  it('starts the verified profile read before hydration and hands each result off once', async () => {
    const { fetch, requestLock, browser, start } = fixture();
    start();
    start();
    const refresh = consumeEarlyRefresh(base);
    await expect(refresh).resolves.toBe('server-token');
    expect(consumeEarlyRefresh(base)).toBeNull();
    expect(requestLock).toHaveBeenCalledWith('meow-session-refresh', expect.objectContaining({ signal: expect.any(AbortSignal) }), expect.any(Function));
    expect(fetch).toHaveBeenNthCalledWith(1, `${base}/auth/refresh`, expect.objectContaining({
      method: 'POST', credentials: 'include', body: '{}',
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, `${base}/users/me`, expect.objectContaining({
      headers: { Authorization: 'Bearer server-token' }, credentials: 'include',
    }));
    const controller = new AbortController();
    await expect(consumeEarlyProfile(base, 'server-token', controller.signal)).resolves.toEqual(profile);
    expect(consumeEarlyProfile(base, 'server-token', controller.signal)).toBeNull();
    expect(browser.__MEOW_SESSION_BOOTSTRAP__).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shares an in-flight profile response instead of starting another request', async () => {
    const { fetch, start } = fixture();
    const pending = deferred<ReturnType<typeof response>>();
    fetch.mockReset().mockResolvedValueOnce(response({ token: 'server-token' })).mockReturnValueOnce(pending.promise);
    start();
    await consumeEarlyRefresh(base);
    const ready = consumeEarlyProfile(base, 'server-token', new AbortController().signal);
    pending.resolve(response(profile));
    await expect(ready).resolves.toEqual(profile);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([response({}, false), response({}), response({ token: null })])('does not request a profile for a guest or failed exchange', async result => {
    const { fetch, start } = fixture();
    fetch.mockReset().mockResolvedValueOnce(result);
    start();
    await expect(consumeEarlyRefresh(base)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(consumeEarlyProfile(base, 'other', new AbortController().signal)).toBeNull();
  });

  it('ignores a profile belonging to a different token', async () => {
    const { browser, start } = fixture();
    start();
    await consumeEarlyRefresh(base);
    const state = browser.__MEOW_SESSION_BOOTSTRAP__!;
    expect(consumeEarlyProfile(base, 'different-login', new AbortController().signal)).toBeNull();
    expect(state.cancelled).toBe(true);
  });

  it('discards pending work on logout and cannot accept its late response', async () => {
    const { fetch, browser, start } = fixture();
    const pending = deferred<ReturnType<typeof response>>();
    fetch.mockReset().mockResolvedValueOnce(response({ token: 'server-token' })).mockReturnValueOnce(pending.promise);
    start();
    await consumeEarlyRefresh(base);
    const state = browser.__MEOW_SESSION_BOOTSTRAP__!;
    discardEarlySession();
    pending.resolve(response(profile));
    expect(state.cancelled).toBe(true);
    expect(consumeEarlyProfile(base, 'server-token', new AbortController().signal)).toBeNull();
  });

  it('cancels a consumed preload when the provider read is aborted', async () => {
    const { fetch, browser, start } = fixture();
    const pending = deferred<ReturnType<typeof response>>();
    fetch.mockReset().mockResolvedValueOnce(response({ token: 'server-token' })).mockReturnValueOnce(pending.promise);
    start();
    await consumeEarlyRefresh(base);
    const state = browser.__MEOW_SESSION_BOOTSTRAP__!;
    const controller = new AbortController();
    const ready = consumeEarlyProfile(base, 'server-token', controller.signal);
    controller.abort();
    pending.resolve(response(profile));
    await expect(ready).resolves.toBeUndefined();
    expect(state.cancelled).toBe(true);
  });

  it.each([response({}, false), response({}), response(null)])('allows the existing transport to recover a failed or invalid profile', async result => {
    const { fetch, start } = fixture();
    fetch.mockReset().mockResolvedValueOnce(response({ token: 'server-token' })).mockResolvedValueOnce(result);
    start();
    await consumeEarlyRefresh(base);
    await expect(consumeEarlyProfile(base, 'server-token', new AbortController().signal)).resolves.toBeUndefined();
  });

  it('expires unconsumed results after fifteen seconds', async () => {
    vi.useFakeTimers();
    const { browser, start } = fixture();
    start();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(browser.__MEOW_SESSION_BOOTSTRAP__).toBeUndefined();
    expect(consumeEarlyRefresh(base)).toBeNull();
  });

  it('also bounds time spent waiting for a refresh lock in another tab', async () => {
    vi.useFakeTimers();
    const { requestLock, fetch, start } = fixture();
    requestLock.mockImplementation((_name, options) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('lock wait aborted')), { once: true });
    }));
    start();
    const ready = consumeEarlyRefresh(base);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(ready).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not hand off results to a differently configured API', () => {
    const { start } = fixture();
    start();
    expect(consumeEarlyRefresh('https://different.example.test')).toBeNull();
  });

  it('works without Web Locks and safely declines unsupported browser APIs', async () => {
    const { browser, start } = fixture();
    Object.defineProperty(browser.navigator, 'locks', { value: undefined });
    start();
    await expect(consumeEarlyRefresh(base)).resolves.toBe('server-token');
    discardEarlySession();
    Object.defineProperty(browser, 'AbortController', { value: undefined });
    start();
    expect(consumeEarlyRefresh(base)).toBeNull();
  });

  it('contains an offline exchange failure without an unhandled rejection', async () => {
    const { fetch, start } = fixture();
    fetch.mockReset().mockRejectedValueOnce(new Error('offline'));
    start();
    await expect(consumeEarlyRefresh(base)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('escapes HTML-sensitive configuration in the serialized script', () => {
    expect(earlySessionScript('</script><script>example</script>')).not.toContain('</script>');
  });
});
