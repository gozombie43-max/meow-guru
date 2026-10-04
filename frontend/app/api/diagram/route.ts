import { NextRequest } from 'next/server';
import { proxyBackendPost } from '@/lib/server/backend-proxy';

export async function POST(req: NextRequest) {
  return proxyBackendPost(req, '/api/ai/diagram', 50000);
}
