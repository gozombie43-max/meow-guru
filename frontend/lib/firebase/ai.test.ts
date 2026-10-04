import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { app, appCheck, initializeAppCheck, getAI, getGenerativeModel } = vi.hoisted(() => ({
  app: { name: '[DEFAULT]' },
  appCheck: { app: { name: '[DEFAULT]' } },
  initializeAppCheck: vi.fn(),
  getAI: vi.fn(),
  getGenerativeModel: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApps: () => [app], getApp: () => app, initializeApp: vi.fn(),
}));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck,
  ReCaptchaEnterpriseProvider: class { constructor(public siteKey: string) {} },
}));
vi.mock('firebase/ai', () => ({
  getAI, getGenerativeModel, GoogleAIBackend: class {},
}));

const appCheckGlobal = globalThis as typeof globalThis & {
  __meowAppCheck?: unknown;
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
};

describe('Firebase AI Logic initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    delete appCheckGlobal.__meowAppCheck;
    delete appCheckGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN;
    initializeAppCheck.mockReturnValue(appCheck);
    getAI.mockReturnValue({ app });
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY', 'test-site-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete appCheckGlobal.__meowAppCheck;
    delete appCheckGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  it('initializes App Check before creating either Gemini model', async () => {
    getAI.mockImplementation(() => {
      expect(initializeAppCheck).toHaveBeenCalledWith(app, expect.objectContaining({
        isTokenAutoRefreshEnabled: true,
      }));
      return { app };
    });
    await import('./ai');
    expect(getAI.mock.calls[0][0]).toBe(app);
    expect(getGenerativeModel).toHaveBeenCalledTimes(2);
    const { getFirebaseAppCheck } = await import('./client');
    expect(getFirebaseAppCheck()).toBe(appCheck);
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(appCheckGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('fails before making AI requests when the production site key is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY', '');
    await expect(import('./ai')).rejects.toMatchObject({ code: 'appCheck/missing-site-key' });
    expect(getAI).not.toHaveBeenCalled();
  });
});
