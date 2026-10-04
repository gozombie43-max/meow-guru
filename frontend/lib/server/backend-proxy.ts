import { NextRequest, NextResponse } from 'next/server';

/** Same-origin transport only. Express owns authentication, quotas and providers. */
export async function proxyBackendPost(req: NextRequest, path: string, timeoutMs = 25000) {
  const headers = new Headers();
  for (const name of ['authorization', 'content-type', 'idempotency-key', 'x-request-id', 'traceparent', 'tracestate']) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const backend = (process.env.API_URL || 'http://localhost:10000').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backend}${path}`, {
      method: 'POST', headers, body: req.body, duplex: 'half',
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(timeoutMs)]), cache: 'no-store',
    } as RequestInit & { duplex: 'half' });
    const forwarded = new Headers();
    for (const name of ['content-type', 'cache-control', 'retry-after', 'x-request-id']) {
      const value = response.headers.get(name);
      if (value) forwarded.set(name, value);
    }
    return new NextResponse(response.body, { status: response.status, headers: forwarded });
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please retry.' }, { status: 502 });
  }
}
