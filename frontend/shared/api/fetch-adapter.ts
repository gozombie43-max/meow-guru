import { ApiError, normalizeError } from './error';
import { abortError, canRetry, retryCount, retryDelay, waitForRetry, type RetryPolicy } from './policy';
import { isFirstPartyApi } from './policy';
import { correlationHeaders } from './correlation';

// Server and streaming adapter. Authentication is supplied by the caller's request.
export async function fetchResponse(url: string, options: RequestInit = {}, policy: RetryPolicy = {}): Promise<Response> {
  const signal = options.signal;
  if (isFirstPartyApi(url)) {
    const headers = new Headers(options.headers);
    if (!headers.has('traceparent')) for (const [name, value] of Object.entries(correlationHeaders())) if (!headers.has(name)) headers.set(name, value);
    options = { ...options, headers };
  }
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw normalizeError(abortError(), signal);
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, policy.timeoutMs ?? 15000);
    let response: Response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      const normalized = timedOut && !signal?.aborted
        ? new ApiError('Request timed out', 'timeout', undefined, undefined, { cause: error }) : normalizeError(error, signal);
      if (normalized.kind === 'cancelled' || attempt >= retryCount(policy) || !canRetry(options.method ?? 'GET', undefined, policy, new Headers(options.headers).get('Idempotency-Key'))) throw normalized;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      await waitForRetry(retryDelay(attempt, policy), signal).catch(error => { throw normalizeError(error, signal); });
      continue;
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
    if (attempt >= retryCount(policy) || !canRetry(options.method ?? 'GET', response.status, policy, new Headers(options.headers).get('Idempotency-Key'))) return response;
    const delay = retryDelay(attempt, policy, response.headers.get('retry-after'));
    await response.body?.cancel();
    await waitForRetry(delay, signal).catch(error => { throw normalizeError(error, signal); });
  }
}
