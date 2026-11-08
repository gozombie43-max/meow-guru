import { NextResponse } from 'next/server';
import { createAccessSessionToken } from '@/proxy';

function parseTokenClaims(token: unknown): { timestamp: number; codeId: string } {
  if (typeof token === 'string') {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex > 0) {
      const payload = token.slice(0, dotIndex);
      const colonIndex = payload.indexOf(':');
      if (colonIndex > 0 && colonIndex < payload.length - 1) {
        const parsedTs = parseInt(payload.slice(0, colonIndex), 10);
        const codeId = payload.slice(colonIndex + 1).trim();
        if (Number.isFinite(parsedTs) && parsedTs > 0 && codeId) {
          return { timestamp: parsedTs, codeId };
        }
      }
    }
  }
  return { timestamp: Date.now(), codeId: 'access' };
}

function resolveTrustedForwardedFor(req: Request): string | null {
  const isTrustedProxy =
    process.env.VERCEL === '1' || process.env.TRUST_PROXY === 'true';
  if (!isTrustedProxy) {
    return null;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }
  const hops = forwardedFor
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  return hops.at(-1) || null;
}

export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body' }, { status: 400 });
  }

  const backendUrl = (process.env.API_URL || 'http://localhost:10000').replace(/\/+$/, '');
  const trustedClientIp = resolveTrustedForwardedFor(req);

  try {
    const backendRes = await fetch(`${backendUrl}/api/access-code/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(trustedClientIp ? { 'x-forwarded-for': trustedClientIp } : {}),
      },
      body: JSON.stringify({ code: body.code }),
      cache: 'no-store',
    });

    const data = (await backendRes.json()) as {
      valid?: boolean;
      token?: string;
      error?: string;
    };

    if (backendRes.ok && data?.valid) {
      const { timestamp, codeId } = parseTokenClaims(data.token);
      const frontendToken = createAccessSessionToken(codeId, timestamp) || data.token || '';
      const response = NextResponse.json(
        { valid: true },
        { status: backendRes.status }
      );
      if (frontendToken) {
        response.cookies.set('access_session', frontendToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 24 * 60 * 60,
        });
      }
      return response;
    }

    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Connection error. Please try again.' },
      { status: 503 }
    );
  }
}
