export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'cancelled' | 'parse';

export class ApiError extends Error {
  // Compatibility fields for consumers migrating from Axios error inspection.
  readonly response?: unknown;
  readonly isAxiosError?: boolean;
  readonly __CANCEL__?: boolean;
  constructor(message: string, public readonly kind: ApiErrorKind, public readonly status?: number,
    public readonly requestId?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = kind === 'cancelled' ? 'AbortError' : 'ApiError';
    const cause = options?.cause as { response?: unknown; isAxiosError?: boolean } | undefined;
    this.response = cause?.response;
    this.isAxiosError = cause?.isAxiosError;
    this.__CANCEL__ = kind === 'cancelled';
  }
}

export function normalizeError(error: unknown, signal?: AbortSignal | null): ApiError {
  if (error instanceof ApiError) return error;
  const detail = error as { name?: string; code?: string; response?: { status: number; headers?: Record<string, string> } };
  const kind = signal?.aborted || detail?.name === 'AbortError' || detail?.code === 'ERR_CANCELED' ? 'cancelled'
    : detail?.code === 'ECONNABORTED' || detail?.code === 'ETIMEDOUT' ? 'timeout' : detail?.response ? 'http' : 'network';
  const status = detail?.response?.status;
  return new ApiError(kind === 'cancelled' ? 'Request cancelled' : kind === 'timeout' ? 'Request timed out'
    : kind === 'http' ? `Request failed (${status})` : 'Unable to reach the service', kind, status,
    detail?.response?.headers?.['x-request-id'], { cause: error });
}
