import { afterAll, expect, it, vi } from 'vitest';
import express from 'express';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { requestTrace, traceCarrier, traceFields, withTrace, withTraceCarrier } from '../tracing.js';
import { sanitizedExporter } from '../traceExporter.js';

const exporter = new InMemorySpanExporter();
const sdk = new NodeSDK({ spanProcessors: [new SimpleSpanProcessor(sanitizedExporter(exporter))] });
sdk.start();
afterAll(() => sdk.shutdown());

it('connects an incoming W3C trace, dependency span and log correlation without question data', async () => {
  const app = express();
  let fields, carrier;
  app.use(requestTrace);
  app.get('/questions/:id', async (_req, res) => {
    fields = traceFields();
    carrier = traceCarrier();
    await withTrace('catalog.read', { 'dependency.name': 'mongo', 'url.full': 'https://storage.example/?token=secret', 'db.query.text': 'secret document' }, async () => {});
    res.json({ ok: true });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const traceId = '12345678901234567890123456789012';
    await fetch(`http://127.0.0.1:${server.address().port}/questions/secret-id?token=secret`, { headers: { traceparent: `00-${traceId}-1234567890123456-01`, 'x-request-id': 'fixture-request-123' } });
    expect(fields.traceId).toBe(traceId);
    expect(fields.requestId).toBe('fixture-request-123');
    expect(carrier.traceparent).toContain(traceId);
    expect(carrier['x-request-id']).toBe('fixture-request-123');
    await vi.waitFor(() => expect(exporter.getFinishedSpans()).toHaveLength(2));
    const spans = exporter.getFinishedSpans();
    expect(spans.map(s => s.name)).toEqual(['catalog.read', 'GET /questions/:id']);
    expect(spans[0].spanContext().traceId).toBe(traceId);
    expect(JSON.stringify(spans.map(s => s.attributes))).not.toMatch(/secret/);
    // The request has finished; a durable worker restores its stored carrier.
    await withTraceCarrier(carrier, () => withTrace('job.resume', { 'job.type': 'fixture' }, async () => {
      expect(traceFields()).toMatchObject({ traceId, requestId: 'fixture-request-123' });
    }));
    expect(exporter.getFinishedSpans().at(-1).name).toBe('job.resume');
    expect(exporter.getFinishedSpans().at(-1).spanContext().traceId).toBe(traceId);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
