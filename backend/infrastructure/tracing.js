import { context, propagation, trace, SpanStatusCode, createContextKey } from '@opentelemetry/api';
import { createHash, randomUUID } from 'node:crypto';

const getTracer = () => trace.getTracer('meow.backend');
const requestKey = createContextKey('meow.request-id');

export function traceFields() {
  const current = trace.getSpan(context.active())?.spanContext();
  return current?.traceId && current.traceId !== '00000000000000000000000000000000'
    ? { traceId: current.traceId, spanId: current.spanId, ...(context.active().getValue(requestKey) ? { requestId: context.active().getValue(requestKey) } : {}) } : {};
}

export function requestTrace(req, res, next) {
  const supplied = req.headers['x-request-id'];
  req.id = typeof supplied === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(supplied) ? supplied : randomUUID();
  const parent = propagation.extract(context.active(), req.headers).setValue(requestKey, req.id);
  return context.with(parent, () => getTracer().startActiveSpan(`HTTP ${req.method}`, span => {
    span.setAttribute('http.request.method', req.method);
    const finish = () => {
      const route = req.route ? `${req.baseUrl || ''}${String(req.route.path)}` : 'unmatched';
      span.updateName(`${req.method} ${route}`);
      span.setAttributes({ 'http.route': route, 'http.response.status_code': res.statusCode });
      span.setAttribute('request.id', req.id);
      if (req.user?.id) span.setAttribute('user.hash', createHash('sha256').update(String(req.user.id)).digest('hex').slice(0, 16));
      if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    };
    res.once('finish', finish);
    res.once('close', () => { if (!res.writableFinished) { span.setStatus({ code: SpanStatusCode.ERROR }); finish(); } });
    next();
  }));
}

// Attributes must be identifiers/types, never prompts, documents, tokens or URLs.
export function withTrace(name, attributes, work) {
  return getTracer().startActiveSpan(name, { attributes }, async span => {
    try { return await work(); }
    catch (error) { span.setStatus({ code: SpanStatusCode.ERROR }); throw error; }
    finally { span.end(); }
  });
}

export function traceCarrier() {
  const carrier = {};
  propagation.inject(context.active(), carrier);
  const requestId = context.active().getValue(requestKey);
  if (requestId) carrier['x-request-id'] = requestId;
  return carrier;
}

export function withTraceCarrier(carrier, work) {
  let parent = propagation.extract(context.active(), carrier || {});
  if (/^[a-zA-Z0-9_-]{1,80}$/.test(carrier?.['x-request-id'] || '')) parent = parent.setValue(requestKey, carrier['x-request-id']);
  return context.with(parent, work);
}

export function tracedSocketListener(socket, event, listener) {
  return (...args) => withTraceCarrier(socket.handshake?.headers, () => withTrace(`socket.${event}`, {
    'messaging.operation.name': event,
    'user.hash': createHash('sha256').update(String(socket.user?.id || 'anonymous')).digest('hex').slice(0, 16),
  }, () => listener(...args)));
}
