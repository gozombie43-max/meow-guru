import { NextRequest, NextResponse } from "next/server";

// Backend owns admission, provider policy and structured validation for this use case.
export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await req.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
  if (question.length > 4000) return NextResponse.json({ error: 'Question text is too long' }, { status: 413 });
  const backend = (process.env.API_URL || process.env.AZURE_BACKEND_URL || 'http://localhost:10000').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backend}/api/ai/diagram`, {
      method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }), signal: AbortSignal.any([req.signal, AbortSignal.timeout(50000)]), cache: 'no-store',
    });
    return new NextResponse(await response.text(), { status: response.status, headers: {
      'Content-Type': 'application/json', ...(response.headers.has('retry-after') ? { 'Retry-After': response.headers.get('retry-after')! } : {}),
    } });
  } catch { return NextResponse.json({ error: 'AI service unavailable. Please retry.' }, { status: 502 }); }
}
