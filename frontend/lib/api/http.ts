type FetchRetryConfig = {
  attempts?: number;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
  retryMethods?: string[];
};

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
const DEFAULT_RETRY_METHODS = ["GET", "HEAD", "OPTIONS"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: FetchRetryConfig = {}
) {
  const {
    attempts,
    timeoutMs = 12000,
    retries = 2,
    retryDelayMs = 1200,
    retryOnStatuses = DEFAULT_RETRY_STATUSES,
    retryMethods = DEFAULT_RETRY_METHODS,
  } = config;
  const resolvedRetries = Math.max(0, (attempts ?? (retries + 1)) - 1);

  const method = (options.method || "GET").toUpperCase();
  const shouldRetryMethod = retryMethods.includes(method);
  const externalSignal = options.signal;

  let lastError: unknown;

  for (let attempt = 0; attempt <= resolvedRetries; attempt += 1) {
    const controller = new AbortController();
    const abortFromExternalSignal = () => {
      controller.abort(externalSignal?.reason);
    };

    if (externalSignal?.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
    }

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);

      if (shouldRetryMethod && retryOnStatuses.includes(res.status) && attempt < resolvedRetries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
      lastError = err;

      if (externalSignal?.aborted) throw err;
      if (!shouldRetryMethod || attempt >= resolvedRetries) throw err;

      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Request failed");
}
