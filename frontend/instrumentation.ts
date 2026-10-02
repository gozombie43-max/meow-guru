import type { Instrumentation } from "next";

function monitoringConfigured() {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export async function register() {
  if (!monitoringConfigured()) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (!monitoringConfigured()) return;
  const Sentry = await import("@sentry/nextjs");
  await Sentry.captureRequestError(...args);
};
