import { expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { verifyFixtureEmail } from './verify-fixture-email';

export const FIXTURE_BACKEND_URL = 'http://127.0.0.1:3111';
export const FIXTURE_FRONTEND_URL = 'http://127.0.0.1:3110';
export const FIXTURE_PASSWORD = 'Browser-fixture-123!';

export async function loginFixtureUser(
  request: APIRequestContext,
  email: string,
  password = FIXTURE_PASSWORD,
) {
  const login = await request.post(`${FIXTURE_BACKEND_URL}/auth/login`, {
    data: { email, password },
  });
  expect(login.ok(), `Fixture login for ${email}`).toBeTruthy();
  const body = await login.json();
  const setCookie = login.headers()['set-cookie'] ?? '';
  const refreshCookie = setCookie.includes('refreshToken=')
    ? setCookie.split(';')[0].slice('refreshToken='.length)
    : undefined;
  return {
    token: body.token as string,
    user: body.user as { id: string; name: string; email: string; role: string },
    refreshCookie,
  };
}

export async function registerAndLoginIsolatedUser(
  request: APIRequestContext,
  prefix: string,
  name = 'Fixture Student',
) {
  const credentials = {
    email: `${prefix}-${randomUUID()}@example.test`,
    password: FIXTURE_PASSWORD,
  };
  const registration = await request.post(`${FIXTURE_BACKEND_URL}/auth/register`, {
    data: { name, ...credentials },
  });
  expect(registration.ok(), `Create isolated account for ${prefix}`).toBeTruthy();
  await verifyFixtureEmail(request, credentials.email);
  const session = await loginFixtureUser(request, credentials.email, credentials.password);
  return { credentials, ...session };
}

export async function routeBackendApi(
  context: BrowserContext,
  options: {
    token?: string;
    accessSession?: string;
    refreshCookie?: string;
    frontendUrl?: string;
  } = {},
) {
  const {
    token,
    accessSession = 'local-navigation-fixture',
    refreshCookie,
    frontendUrl = FIXTURE_FRONTEND_URL,
  } = options;
  const hostname = new URL(frontendUrl).hostname;
  const cookies: Parameters<BrowserContext['addCookies']>[0] = [
    ...(refreshCookie
      ? [
          {
            name: 'refreshToken',
            value: refreshCookie,
            domain: hostname,
            path: '/',
            httpOnly: true,
            sameSite: 'Lax' as const,
          },
        ]
      : []),
    { name: 'access_session', value: accessSession, domain: hostname, path: '/' },
  ];
  await context.addCookies(cookies);
  await context.route('**/backend-api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/backend-api/, '');
    if (token && path === '/auth/refresh') {
      return route.fulfill({ json: { token } });
    }
    const response = await route.fetch({ url: `${FIXTURE_BACKEND_URL}${path}${url.search}` });
    return route.fulfill({ response });
  });
}
