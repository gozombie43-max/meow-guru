import { createServer } from 'node:http';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Collector and HTTP dependency are disposable localhost fixtures. No cloud
// telemetry or providers are contacted by this preload/export verification.
const payloads = [];
let mongo;
const collector = createServer(async (req, res) => {
  if (req.url === '/v1/traces') {
    let body = ''; for await (const chunk of req) body += chunk;
    payloads.push(JSON.parse(body));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}');
});
collector.listen(0, '127.0.0.1'); await once(collector, 'listening');
const base = `http://127.0.0.1:${collector.address().port}`;
try {
  if (process.argv.includes('--with-mongo')) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongo = await MongoMemoryServer.create();
  }
  const mongoProbe = mongo ? `const { MongoClient } = await import('mongodb'); const client = new MongoClient(process.env.TRACE_TEST_MONGO_URI); await withTrace('runtime.mongo', {}, async () => { await client.connect(); const collection = client.db('tracing_runtime').collection('probe'); await collection.insertOne({ value: 'fixture' }); await collection.findOne({ value: 'fixture' }); }); await client.close();` : '';
  const code = `const { withTrace } = await import('./infrastructure/tracing.js'); await withTrace('runtime.preload', { 'url.full': 'secret-signed-url' }, () => fetch('${base}/dependency?token=secret')); ${mongoProbe} await globalThis.__shutdownTelemetry();`;
  await promisify(execFile)(process.execPath, ['--import', './instrumentation.js', '--input-type=module', '--eval', code], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), timeout: 30000, windowsHide: true,
    env: {
      ...process.env,
      // This child verifies runtime preload against disposable local services.
      NODE_ENV: 'test', DEPLOYMENT_ENVIRONMENT: 'test',
      JWT_SECRET: randomBytes(32).toString('hex'),
      REFRESH_TOKEN_SECRET: randomBytes(32).toString('hex'),
      TRACE_TEST_MONGO_URI: mongo?.getUri() || '',
      OTEL_ENABLED: 'true', OTEL_TRACES_SAMPLER: 'always_on',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${base}/v1/traces`,
      OTEL_EXPORTER_OTLP_HEADERS: '', OTEL_RESOURCE_ATTRIBUTES: '',
    },
  });
  const spans = payloads.flatMap(data => data.resourceSpans || []).flatMap(resource => resource.scopeSpans || []).flatMap(scope => scope.spans || []);
  assert(spans.some(span => span.name === 'runtime.preload'), 'Manual span did not reach the local collector');
  assert(spans.some(span => span.name === 'GET'), 'Outgoing fetch auto-instrumentation did not load');
  if (mongo) assert(spans.some(span => span.attributes?.some(attribute => attribute.key === 'db.system.name' && attribute.value?.stringValue === 'mongodb')), 'Mongo auto-instrumentation did not load');
  assert(!JSON.stringify(payloads).includes('secret'), 'Exporter leaked URL credentials');
  console.log(`ESM preload, fetch${mongo ? '/Mongo' : ''} instrumentation, OTLP export and URL redaction passed.`);
} finally { collector.closeAllConnections(); await new Promise(resolve => collector.close(resolve)); await mongo?.stop(); }
