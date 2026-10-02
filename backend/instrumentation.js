import 'dotenv/config';
import { getReleaseId } from './infrastructure/releaseInfo.js';
import { sanitizedExporter } from './infrastructure/traceExporter.js';

// Preload before any HTTP/Mongo/provider modules are imported. Export is opt-in.
if (process.env.OTEL_ENABLED === 'true') {
  process.env.OTEL_TRACES_SAMPLER ||= 'traceidratio';
  process.env.OTEL_TRACES_SAMPLER_ARG ||= '0.1';
  const { register } = await import('node:module');
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
  const [sdk, exporter, resources, http, express, mongo, undici] = await Promise.all([
    import('@opentelemetry/sdk-node'), import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/resources'), import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-express'), import('@opentelemetry/instrumentation-mongodb'),
    import('@opentelemetry/instrumentation-undici'),
  ]);
  const instance = new sdk.NodeSDK({
    resource: resources.resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME || 'meow-backend',
      'service.version': getReleaseId(),
      'deployment.environment.name': process.env.DEPLOYMENT_ENVIRONMENT || 'local',
    }),
    traceExporter: sanitizedExporter(new exporter.OTLPTraceExporter()),
    instrumentations: [
      new http.HttpInstrumentation({ disableIncomingRequestInstrumentation: true }),
      new express.ExpressInstrumentation(),
      new mongo.MongoDBInstrumentation({ enhancedDatabaseReporting: false, dbStatementSerializer: () => '[redacted]' }),
      new undici.UndiciInstrumentation(),
    ],
  });
  instance.start();
  globalThis.__shutdownTelemetry = () => instance.shutdown();
}
