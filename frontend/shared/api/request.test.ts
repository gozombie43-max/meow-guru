import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { updateAccessToken } from '@/lib/axios';
import { request, requestResponse } from './request';
import { fetchResponse } from './fetch-adapter';

const originalAdapter = api.defaults.adapter;
const response = (config: InternalAxiosRequestConfig, status = 200, data = '{"ok":true}') => ({
  config, status, statusText: String(status), headers: { 'content-type': 'application/json' }, data: new TextEncoder().encode(data).buffer,
});
beforeEach(() => updateAccessToken('old-token'));
afterEach(() => { api.defaults.adapter = originalAdapter; updateAccessToken(null); });

describe('shared request contract', () => {
  it('does not dispatch an already cancelled request', async () => {
    const adapter = vi.fn(); api.defaults.adapter = adapter;
    const controller = new AbortController(); controller.abort();
    await expect(request('/backend-api/read', { signal: controller.signal })).rejects.toMatchObject({ kind: 'cancelled' });
    expect(adapter).not.toHaveBeenCalled();
  });

  it('strips the session bearer from external streaming requests', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await requestResponse('https://files.example.org/stream', { headers: { Authorization: 'Bearer old-token' } }, { responseType: 'stream' });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).has('authorization')).toBe(false);
    expect(fetch.mock.calls[0][1]?.credentials).toBe('omit');
  });

  it('normalizes cancellation during native retry backoff', async () => {
    const controller = new AbortController();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      setTimeout(() => controller.abort(), 0);
      return new Response('', { status: 503 });
    });
    await expect(fetchResponse('https://backend.example/api', { signal: controller.signal }, { retryDelayMs: 5000 })).rejects.toMatchObject({ kind: 'cancelled' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes concurrent first-party 401s once and retries with the new token', async () => {
    const refresh = vi.spyOn(axios, 'post').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { data: { token: 'new-token' } };
    });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer old-token') throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, response(config, 401));
      return response(config);
    });
    api.defaults.adapter = adapter;
    expect(await Promise.all([request('/backend-api/a'), request('/backend-api/b')])).toEqual([{ ok: true }, { ok: true }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(4);
  });

  it('does not attach session credentials or refresh on third-party failures', async () => {
    const refresh = vi.spyOn(axios, 'post');
    api.defaults.adapter = async config => {
      expect(config.headers.Authorization).toBeUndefined();
      expect(config.withCredentials).toBe(false);
      throw new AxiosError('denied', 'ERR_BAD_REQUEST', config, undefined, response(config, 401));
    };
    await expect(request('https://files.example.org/download')).rejects.toMatchObject({ kind: 'http', status: 401 });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not loop after refresh rejection', async () => {
    const refresh = vi.spyOn(axios, 'post').mockRejectedValue({ response: { status: 401 } });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => { throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, response(config, 401)); });
    api.defaults.adapter = adapter;
    await expect(request('/backend-api/private')).rejects.toMatchObject({ status: 401 });
    expect(adapter).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('preserves multipart bodies and binary downloads without duplicating the API prefix', async () => {
    const body = new FormData(); body.append('file', new Blob(['data']), 'test.txt');
    api.defaults.adapter = async config => {
      expect(api.getUri(config)).toBe('/backend-api/upload');
      expect(config.data).toBe(body);
      expect(config.headers.getContentType()).not.toBe('application/json');
      return response(config, 200, 'binary data');
    };
    const result = await requestResponse('/backend-api/upload', { method: 'POST', body });
    expect(await result.text()).toBe('binary data');
  });

  it('retries reads with a single budget and does not retry writes', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => { throw new AxiosError('unavailable', 'ERR_BAD_RESPONSE', config, undefined, response(config, 503)); });
    api.defaults.adapter = adapter;
    await expect(request('/backend-api/read', {}, { retries: 1, retryDelayMs: 0 })).rejects.toMatchObject({ status: 503 });
    expect(adapter).toHaveBeenCalledTimes(2); adapter.mockClear();
    await expect(request('/backend-api/write', { method: 'POST' })).rejects.toMatchObject({ status: 503 });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('cancels retry backoff immediately and never dispatches another attempt', async () => {
    const controller = new AbortController();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      setTimeout(() => controller.abort(), 0);
      throw new AxiosError('offline', 'ERR_NETWORK', config);
    });
    api.defaults.adapter = adapter;
    await expect(request('/backend-api/read', { signal: controller.signal }, { retryDelayMs: 5000 })).rejects.toMatchObject({ kind: 'cancelled' });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('keeps caller credentials isolated in the native server adapter', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await fetchResponse('https://backend.example/api', { headers: { Authorization: 'Bearer incoming-request' } });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('authorization')).toBe('Bearer incoming-request');
  });
});
