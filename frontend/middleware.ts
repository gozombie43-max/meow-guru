import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — Access Code Gate + Route Redirects
 *
 * 1. Redirects /Videos → /videos (case-fix)
 * 2. Checks for `access_session` cookie on every page request.
 *    If missing → redirects to /access-code.
 *
 * IMPORTANT: /backend-api/* must NEVER be intercepted here.
 * These are proxy requests forwarded to the Azure backend via next.config.ts rewrites.
 * If middleware redirects them, Vercel returns 307 → /access-code → 405.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── /Videos case redirect ──
  if (pathname === '/Videos' || pathname.startsWith('/Videos/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/Videos/, '/videos');
    return NextResponse.redirect(url);
  }

  // ── Access Code Gate ──
  // Paths that must NEVER be gated (pass straight through)
  const isExempt =
    pathname.startsWith('/backend-api') ||   // ← Azure backend proxy — NEVER block
    pathname.startsWith('/api/') ||           // Next.js API routes
    pathname === '/access-code' ||
    pathname.startsWith('/access-code/') ||
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
  // Exclude backend-api, api routes, static assets, and Next.js internals from matcher.
  // This is the primary defence — middleware won't even run for these paths.
  matcher: [
    '/((?!backend-api|api|_next/static|_next/image|favicon.ico).*)',
  ],
};
