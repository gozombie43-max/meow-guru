export function correlationHeaders() {
  const requestId = crypto.randomUUID();
  // One W3C parent per logical request; retries preserve it to join the same trace.
  return { 'X-Request-ID': requestId, traceparent: `00-${requestId.replaceAll('-', '')}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}-01` };
}
