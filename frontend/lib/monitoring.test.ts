// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({ name: 'Replay' })),
  captureException: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  captureRequestError: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => sdk);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.init.mockReset();
  vi.stubEnv('SENTRY_DSN', '');
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
});
afterEach(() => vi.unstubAllEnvs());

it('does not initialize the SDK or capture errors without a client DSN', async () => {
  const monitoring = await import('./client-monitoring');
  expect(await monitoring.initializeClientMonitoring()).toBeNull();
  await monitoring.captureClientException(new Error('unconfigured'));
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.captureException).not.toHaveBeenCalled();
});

it('initializes once for concurrent callers and retains replay masking and sampling', async () => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.test/1');
  const monitoring = await import('./client-monitoring');
  await Promise.all([monitoring.initializeClientMonitoring(), monitoring.initializeClientMonitoring()]);
  expect(sdk.init).toHaveBeenCalledTimes(1);
  expect(sdk.replayIntegration).toHaveBeenCalledWith({ maskAllText: true, blockAllMedia: true });
  expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({
    tracesSampleRate: 0.1, replaysSessionSampleRate: 0.01, replaysOnErrorSampleRate: 1,
    dataCollection: expect.objectContaining({ userInfo: false, cookies: false, httpBodies: [], genAI: { inputs: false, outputs: false } }),
  }));
  const error = new Error('client failure');
  await monitoring.captureClientException(error);
  expect(sdk.captureException).toHaveBeenCalledWith(error);
});

it('can retry initialization after an SDK failure', async () => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.test/1');
  sdk.init.mockImplementationOnce(() => { throw new Error('initialization failed'); });
  const monitoring = await import('./client-monitoring');
  expect(await monitoring.initializeClientMonitoring()).toBeNull();
  expect(await monitoring.initializeClientMonitoring()).not.toBeNull();
  expect(sdk.init).toHaveBeenCalledTimes(2);
});

it.each(['nodejs', 'edge'])('initializes %s request instrumentation with the same restricted collection', async runtime => {
  vi.stubEnv('NEXT_RUNTIME', runtime);
  vi.stubEnv('SENTRY_DSN', 'https://server@example.test/2');
  const instrumentation = await import('../instrumentation');
  await instrumentation.register();
  expect(sdk.init).toHaveBeenCalledTimes(1);
  expect(sdk.init).toHaveBeenCalledWith(expect.objectContaining({
    dsn: 'https://server@example.test/2', enabled: true, tracesSampleRate: 0.1,
    dataCollection: expect.objectContaining({ cookies: false, httpBodies: [], databaseQueryData: false, queues: false }),
  }));
  expect(instrumentation.onRequestError).toBe(sdk.captureRequestError);
});

it('forwards router transitions after lazy initialization', async () => {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.test/1');
  const instrumentation = await import('../instrumentation-client');
  instrumentation.onRouterTransitionStart('/play', 'push');
  await vi.waitFor(() => expect(sdk.captureRouterTransitionStart).toHaveBeenCalledWith('/play', 'push'));
  expect(sdk.init).toHaveBeenCalledTimes(1);
});
