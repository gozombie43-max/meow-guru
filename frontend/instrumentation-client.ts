import { initializeClientMonitoring } from './lib/client-monitoring';

// Unconfigured monitoring must not download/execute the SDK on every route.
void initializeClientMonitoring();

export const onRouterTransitionStart = (...args: Parameters<typeof import('@sentry/nextjs').captureRouterTransitionStart>) => {
  void initializeClientMonitoring().then(Sentry => Sentry?.captureRouterTransitionStart(...args));
};
