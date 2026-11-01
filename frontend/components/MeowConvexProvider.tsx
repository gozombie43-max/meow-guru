'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import type {
  ConvexReactClient as ConvexReactClientType,
} from 'convex/react';

import { useAuth as useMeowAuth } from '@/context/AuthContext';
import api, { getAccessToken } from '@/lib/axios';
import { authSessionIdentity } from '@/lib/auth-session-identity';

interface ConvexTokenResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

const convexEnabled =
  process.env.NEXT_PUBLIC_CONVEX_AUTH_ENABLED === 'true';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (convexEnabled && !convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL is required when Convex auth is enabled.');
}

type AuthHook = () => {
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchAccessToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>;
};

interface ActiveConvexProviderProps {
  client: ConvexReactClientType;
  useAuth: AuthHook;
  children: ReactNode;
}

let ActiveProviderComponent: ComponentType<ActiveConvexProviderProps> | null = null;
let activeConvexClient: ConvexReactClientType | null = null;
let loadPromise: Promise<ComponentType<ActiveConvexProviderProps> | null> | null = null;

function loadConvexModules(): Promise<ComponentType<ActiveConvexProviderProps> | null> {
  if (ActiveProviderComponent) {
    return Promise.resolve(ActiveProviderComponent);
  }
  if (!convexEnabled || !convexUrl) {
    return Promise.resolve(null);
  }
  if (!loadPromise) {
    loadPromise = import('convex/react').then(({ ConvexProviderWithAuth, ConvexReactClient }) => {
      activeConvexClient = new ConvexReactClient(convexUrl);
      ActiveProviderComponent = function ActiveConvexProvider({
        client,
        useAuth,
        children,
      }: ActiveConvexProviderProps) {
        return (
          <ConvexProviderWithAuth client={client} useAuth={useAuth}>
            {children}
          </ConvexProviderWithAuth>
        );
      };
      return ActiveProviderComponent;
    });
  }
  return loadPromise;
}

function useMeowConvexAuth() {
  const { user, token, loading } = useMeowAuth();

  const userId = user?.id ?? null;
  const sessionIdentity = authSessionIdentity(token);

  const cachedToken = useRef<{
    sessionIdentity: string;
    token: string;
    expiresAt: number;
  } | null>(null);

  const inFlight = useRef<{
    sessionIdentity: string;
    promise: Promise<string | null>;
  } | null>(null);

  const fetchAccessToken = useCallback(
    async ({
      forceRefreshToken,
    }: {
      forceRefreshToken: boolean;
    }): Promise<string | null> => {
      if (loading || !userId || !token || !sessionIdentity) {
        cachedToken.current = null;
        return null;
      }

      if (
        !forceRefreshToken &&
        cachedToken.current?.sessionIdentity === sessionIdentity &&
        cachedToken.current.expiresAt > Date.now() + 45_000
      ) {
        return cachedToken.current.token;
      }

      if (inFlight.current?.sessionIdentity === sessionIdentity) {
        return inFlight.current.promise;
      }

      const requestSession = sessionIdentity;
      const _requestUserId = userId;

      const request = (async (): Promise<string | null> => {
        try {
          const { data } = await api.post<ConvexTokenResponse>(
            '/auth/convex/token'
          );

          // Reject responses belonging to an old Meow session.
          if (
            authSessionIdentity(getAccessToken()) !== requestSession
          ) {
            return null;
          }

          if (
            typeof data?.token !== 'string' ||
            !data.token ||
            data.tokenType !== 'Bearer' ||
            !Number.isFinite(data.expiresIn) ||
            data.expiresIn <= 0
          ) {
            throw new Error(
              'Azure returned an invalid Convex token response.'
            );
          }

          cachedToken.current = {
            sessionIdentity: requestSession,
            token: data.token,
            expiresAt: Date.now() + data.expiresIn * 1000,
          };

          return data.token;
        } catch (error) {
          const status = (
            error as { response?: { status?: number } }
          )?.response?.status;

          if (status === 401 || status === 403) {
            cachedToken.current = null;
            return null;
          }

          throw error;
        }
      })();

      inFlight.current = {
        sessionIdentity: requestSession,
        promise: request,
      };

      try {
        return await request;
      } finally {
        if (inFlight.current?.promise === request) {
          inFlight.current = null;
        }
      }
    },
    [loading, userId, token, sessionIdentity]
  );

  const isAuthenticated = !loading && Boolean(user && token);

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated,
      fetchAccessToken,
    }),
    [loading, isAuthenticated, fetchAccessToken]
  );
}

export function MeowConvexProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(
    () => convexEnabled && Boolean(convexUrl) && ActiveProviderComponent !== null
  );

  useEffect(() => {
    if (!convexEnabled || !convexUrl || isLoaded) {
      return;
    }
    let active = true;
    loadConvexModules().then((comp) => {
      if (active && comp) {
        setIsLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [isLoaded]);

  // Keep the existing application operational until the Azure
  // Convex authentication endpoint is deployed.
  if (!convexEnabled || !convexUrl || !isLoaded || !ActiveProviderComponent || !activeConvexClient) {
    return <>{children}</>;
  }

  const Provider = ActiveProviderComponent;
  return (
    <Provider client={activeConvexClient} useAuth={useMeowConvexAuth}>
      {children}
    </Provider>
  );
}
