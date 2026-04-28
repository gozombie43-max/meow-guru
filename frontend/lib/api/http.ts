type FetchRetryConfig = {
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
    timeoutMs = 12000,
    retries = 2,
    retryDelayMs = 1200,
    retryOnStatuses = DEFAULT_RETRY_STATUSES,
    retryMethods = DEFAULT_RETRY_METHODS,
  } = config;

  const method = (options.method || "GET").toUpperCase();
  const shouldRetryMethod = retryMethods.includes(method);
  const externalSignal = options.signal;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: externalSignal ?? controller.signal,
      });
      clearTimeout(timeoutId);

      if (shouldRetryMethod && retryOnStatuses.includes(res.status) && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      if (externalSignal?.aborted) throw err;
      if (!shouldRetryMethod || attempt >= retries) throw err;

      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Request failed");
}
