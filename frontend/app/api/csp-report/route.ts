const MAX_BYTES = 16 * 1024;
let reportWindow = 0;
let logged = 0;

function safeOrigin(value: unknown) {
  if (typeof value !== 'string') return '';
  try { return new URL(value).origin; } catch { return value.slice(0, 40).replace(/[\r\n]/g, ''); }
}

export async function POST(request: Request) {
  const size = Number(request.headers.get('content-length') || 0);
  if (size > MAX_BYTES) return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(value);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { 'csp-report'?: Record<string, unknown> };
    const report = payload?.['csp-report'];
    if (!report || typeof report !== 'object') return new Response(null, { status: 400 });
    if (Date.now() - reportWindow > 60_000) { reportWindow = Date.now(); logged = 0; }
    // Bound unauthenticated logging; omit document paths, query strings and script samples.
    if (logged++ < 10) console.warn('CSP report', {
      directive: String(report['effective-directive'] || '').slice(0, 80).replace(/[\r\n]/g, ''),
      blockedOrigin: safeOrigin(report['blocked-uri']),
    });
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 400 }); }
  finally { reader.releaseLock(); }
}
