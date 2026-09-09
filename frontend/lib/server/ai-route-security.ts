import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

type Quota = { count: number; resetAt: number };
const quotas = new Map<string, Quota>();

function backendUrl() {
  const configured = process.env.API_URL || process.env.AZURE_BACKEND_URL || 'http://localhost:10000';
  return configured.replace(/\/+$/, '');
}

export async function authorizeAiRequest(
  request: NextRequest,
  limit = 30,
  windowMs = 60_000,
): Promise<NextResponse | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const response = await fetch(`${backendUrl()}/users/me`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
  }

  const now = Date.now();
  const key = createHash('sha256').update(authorization).digest('hex');
  const current = quotas.get(key);
  if (!current || current.resetAt <= now) {
    quotas.set(key, { count: 1, resetAt: now + windowMs });
  } else if (current.count >= limit) {
    return NextResponse.json(
      { error: 'AI request limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((current.resetAt - now) / 1000)) } },
    );
  } else {
    current.count += 1;
  }

  if (quotas.size > 5_000) {
    for (const [quotaKey, quota] of quotas) {
      if (quota.resetAt <= now) quotas.delete(quotaKey);
    }
  }
  return null;
}
