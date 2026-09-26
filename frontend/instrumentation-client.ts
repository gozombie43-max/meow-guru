import { initializeClientMonitoring } from './lib/client-monitoring';

// Unconfigured monitoring must not download/execute the SDK on every route.
void initializeClientMonitoring();

// Restore the HttpOnly-cookie session in parallel with framework hydration.
// The auth provider still verifies the user before enabling private queries.
void import('./lib/session-bootstrap').then(({ prepareSessionRestoration }) => {
  prepareSessionRestoration();
}).catch(() => {
  // AuthContext retains its normal restoration path if the chunk cannot load.
});

export const onRouterTransitionStart = (...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>) => {
  void initializeClientMonitoring().then(Sentry => Sentry?.captureRouterTransitionStart(...args));
};
