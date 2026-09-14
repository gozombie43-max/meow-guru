import { API_BASE } from '@/lib/api-base';

export interface RetryPolicy {
  attempts?: number;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
  retryMethods?: string[];
}

export function retryCount(policy: RetryPolicy) {
  return Math.max(0, (policy.attempts ?? ((policy.retries ?? 2) + 1)) - 1);
}

export function canRetry(method: string, status: number | undefined, policy: RetryPolicy) {
  return (policy.retryMethods ?? ['GET', 'HEAD', 'OPTIONS']).some(value => value.toUpperCase() === method.toUpperCase())
    && (status === undefined || (policy.retryOnStatuses ?? [408, 425, 429, 500, 502, 503, 504]).includes(status));
}

export function retryDelay(attempt: number, policy: RetryPolicy, retryAfter?: string | null) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay) && delay > 0) return Math.min(delay, 5000);
  }
  return (policy.retryDelayMs ?? 1200) * (attempt + 1);
}

export function abortError() { return new DOMException('Request cancelled', 'AbortError'); }

export function waitForRetry(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(abortError()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

// Trust the configured API origin AND path prefix, never arbitrary absolute URLs.
export function isFirstPartyApi(url: string) {
  if (typeof window === 'undefined') return false;
  const base = new URL(API_BASE, window.location.origin);
  const target = new URL(url, window.location.origin);
  const proxyPath = target.pathname.replace(/\/$/, '');
  if (target.origin === window.location.origin && ['/api/translate', '/api/diagram', '/api/tts', '/api/upload-image'].includes(proxyPath)) return true;
  const prefix = base.pathname.replace(/\/$/, '');
  return target.origin === base.origin && (target.pathname === prefix || target.pathname.startsWith(`${prefix}/`));
}
