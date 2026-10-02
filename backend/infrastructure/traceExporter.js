// Auto-instrumented HTTP clients can attach signed URLs and query credentials.
// Retain host/method/operation timing while dropping URLs and database bodies.
const forbidden = /^(?:url\.(?:full|path|query)|http\.(?:url|target)|db\.(?:statement|query\.text))$/;
const safeAttributes = attributes => Object.fromEntries(Object.entries(attributes).filter(([key]) => !forbidden.test(key) && !/^process\.(?:command_args|command_line|owner)$/.test(key)));
export function sanitizedExporter(delegate) {
  return {
    export(spans, callback) {
      const safe = spans.map(span => Object.defineProperties(Object.create(span), {
        attributes: { value: safeAttributes(span.attributes) },
        resource: { value: Object.defineProperty(Object.create(span.resource), 'attributes', { value: safeAttributes(span.resource.attributes) }) },
      }));
      delegate.export(safe, callback);
    },
    shutdown: () => delegate.shutdown(),
    forceFlush: () => delegate.forceFlush?.() ?? Promise.resolve(),
  };
}
