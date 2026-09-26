// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { monitoringDataCollection } from './monitoring-options';

afterEach(async () => {
  await Sentry.close(2000);
});

it('delivers an exception through the real Sentry 11 SDK to a local transport', async () => {
  type Envelope = Parameters<ReturnType<NonNullable<Sentry.NodeOptions['transport']>>['send']>[0];
  const events: unknown[] = [];
  Sentry.init({
    dsn: 'https://public@example.test/1',
    dataCollection: monitoringDataCollection,
    environment: 'local-verification',
    release: 'dependency-migration-test',
    // Keep process-wide tracing out of the test runner. Error processing and
    // the transport use the installed SDK; no HTTP transport is constructed.
    enableOpenTelemetrySetup: false,
    tracesSampleRate: 0,
    transport: () => ({
      send: async (envelope: Envelope) => {
        for (const [header, payload] of envelope[1]) {
          if (header.type === 'event') events.push(payload);
        }
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });

  const eventId = Sentry.captureException(new Error('local monitoring verification'));
  expect(await Sentry.flush(2000)).toBe(true);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    event_id: eventId,
    environment: 'local-verification',
    release: 'dependency-migration-test',
    exception: { values: [expect.objectContaining({
      type: 'Error', value: 'local monitoring verification',
      stacktrace: { frames: expect.any(Array) },
    })] },
  });
});
