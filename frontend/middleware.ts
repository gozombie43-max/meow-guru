import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/Videos' || pathname.startsWith('/Videos/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/Videos/, '/videos');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
