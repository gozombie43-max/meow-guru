import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Proxy — Access Code Gate + Route Redirects
 *
 * 1. Redirects /Videos → /videos (case-fix)
 * 2. Checks for `access_session` cookie on every request.
 *    If missing → redirects to /access-code.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── /Videos case redirect ──
  if (pathname === '/Videos' || pathname.startsWith('/Videos/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/Videos/, '/videos');
    return NextResponse.redirect(url);
  }

  // ── Access Code Gate ──
  // Paths that should NOT be gated
  const isExempt =
    pathname === '/access-code' ||
    pathname.startsWith('/access-code/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/auth/') ||
    pathname === '/favicon.ico' ||
    // Static file extensions
    /\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)$/i.test(pathname);

  if (!isExempt) {
    const accessSession = request.cookies.get('access_session');
    if (!accessSession?.value) {
      const accessCodeUrl = new URL('/access-code', request.url);
      return NextResponse.redirect(accessCodeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.swa).*)'],
};
