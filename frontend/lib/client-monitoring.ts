import { monitoringDataCollection } from './monitoring-options';

type SentryClient = typeof import('@sentry/nextjs');
let pending: Promise<SentryClient | null> | undefined;

export function initializeClientMonitoring(): Promise<SentryClient | null> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return Promise.resolve(null);
  pending ??= import('@sentry/nextjs').then(Sentry => {
    Sentry.init({
      dsn,
      dataCollection: monitoringDataCollection,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
      integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.01,
      replaysOnErrorSampleRate: 1,
    });
    return Sentry;
  }).catch(() => {
    pending = undefined;
    return null;
  });
  return pending;
}

export async function captureClientException(error: unknown) {
  (await initializeClientMonitoring())?.captureException(error);
}
