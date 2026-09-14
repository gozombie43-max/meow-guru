import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiError, normalizeError } from './error';
import { fetchResponse } from './fetch-adapter';
import { isFirstPartyApi, type RetryPolicy } from './policy';

export interface RequestPolicy extends RetryPolicy {
  auth?: 'session' | 'none';
  responseType?: 'buffer' | 'stream';
}

declare module 'axios' {
  interface AxiosRequestConfig {
    apiPolicy?: RequestPolicy;
    _retry?: boolean;
    _networkRetryCount?: number;
  }
}

function toResponse(response: AxiosResponse<ArrayBuffer>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(response.headers)) {
    if (value != null) headers.set(key, String(value));
  }
  return new Response([204, 205, 304].includes(response.status) ? null : response.data,
    { status: response.status, statusText: response.statusText, headers });
}

// Compatibility response contract for consumers that need headers, blobs or streams.
export async function requestResponse(url: string, options: RequestInit = {}, policy: RequestPolicy = {}): Promise<Response> {
  if (typeof window === 'undefined') return fetchResponse(url, options, policy);
  const { default: api, getAccessToken, requestTokenRefresh } = await import('@/lib/axios');
  const trusted = isFirstPartyApi(url);
  if (options.keepalive || policy.responseType === 'stream') {
    const session = trusted && policy.auth !== 'none' && options.credentials !== 'omit';
    const send = (token: string | null) => {
      const headers = new Headers(options.headers);
      if (!session && headers.get('Authorization') === `Bearer ${getAccessToken()}`) headers.delete('Authorization');
      if (session && token) headers.set('Authorization', `Bearer ${token}`);
      return fetchResponse(url, { ...options, headers, credentials: session ? 'include' : 'omit' }, policy);
    };
    const response = await send(session ? getAccessToken() : null);
    if (response.status !== 401 || !session || options.signal?.aborted) return response;
    const token = await requestTokenRefresh();
    if (!token) return response;
    await response.body?.cancel();
    return send(token);
  }
  const headers = Object.fromEntries(new Headers(options.headers).entries());
  if ((!trusted || policy.auth === 'none' || options.credentials === 'omit') && headers.authorization === `Bearer ${getAccessToken()}`) delete headers.authorization;
  const config: AxiosRequestConfig = {
    url, baseURL: '', method: options.method ?? 'GET', headers,
    data: options.body, signal: options.signal ?? undefined,
    timeout: policy.timeoutMs ?? 15000, responseType: 'arraybuffer',
    fetchOptions: { cache: options.cache, redirect: options.redirect, mode: options.mode, referrerPolicy: options.referrerPolicy },
    withCredentials: trusted && policy.auth !== 'none' && options.credentials !== 'omit',
    apiPolicy: { ...policy, auth: trusted && policy.auth !== 'none' && options.credentials !== 'omit' ? 'session' : 'none' },
    // Axios must not serialize FormData or coerce a raw request body.
    transformRequest: [(data, requestHeaders) => {
      if (!headers['content-type']) requestHeaders.delete('Content-Type');
      return data;
    }],
  };
  try {
    return toResponse(await api.request<ArrayBuffer>(config));
  } catch (error) {
    const response = (error as { response?: AxiosResponse<ArrayBuffer> }).response;
    if (response) return toResponse(response);
    throw normalizeError(error, options.signal);
  }
}

export async function request<T>(url: string, options: RequestInit = {}, policy: RequestPolicy = {}): Promise<T> {
  const response = await requestResponse(url, options, policy);
  if (!response.ok) throw new ApiError(`Request failed (${response.status})`, 'http', response.status, response.headers.get('x-request-id') ?? undefined);
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch (error) { throw new ApiError('Invalid service response', 'parse', response.status, undefined, { cause: error }); }
}
