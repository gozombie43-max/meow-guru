import { NextRequest, NextResponse } from 'next/server';
const leases = new WeakMap<NextRequest, { backend: string; authorization: string; leaseId: string }>();

export async function releaseAiRequest(request: NextRequest) {
  const lease = leases.get(request);
  if (!lease) return;
  leases.delete(request);
  try {
    await fetch(`${lease.backend}/api/ai/quota/${encodeURIComponent(lease.leaseId)}`, {
      method: 'DELETE', headers: { Authorization: lease.authorization }, signal: AbortSignal.timeout(3000),
    });
  } catch { /* A crashed requester is also covered by the bounded lease expiry. */ }
}

export async function authorizeAiRequest(request: NextRequest, _limit = 30, _windowMs = 60_000): Promise<NextResponse | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const backend = (process.env.API_URL || process.env.AZURE_BACKEND_URL || 'http://localhost:10000').replace(/\/+$/, '');
  try {
    // MongoDB-backed quota follows the user across tokens, tabs and API instances.
    const response = await fetch(`${backend}/api/ai/quota`, {
      method: 'POST', headers: { Authorization: authorization }, cache: 'no-store', signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      const body = await response.json();
      if (typeof body.leaseId !== 'string') return NextResponse.json({ error: 'AI admission unavailable' }, { status: 503 });
      leases.set(request, { backend, authorization, leaseId: body.leaseId });
      return null;
    }
    const status = [401, 403, 429].includes(response.status) ? response.status : 503;
    return NextResponse.json({ error: status === 429 ? 'AI request limit exceeded' : status === 503 ? 'Authentication service unavailable' : 'Invalid or expired session' }, {
      status, headers: response.headers.has('retry-after') ? { 'Retry-After': response.headers.get('retry-after')! } : {},
    });
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }
}
