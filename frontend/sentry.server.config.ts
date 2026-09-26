import * as Sentry from "@sentry/nextjs";
import { monitoringDataCollection } from './lib/monitoring-options';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  dataCollection: monitoringDataCollection,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
