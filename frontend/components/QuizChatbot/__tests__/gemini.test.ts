import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestGeminiTutor, geminiErrorMessage, getGeminiFailure } from '../gemini';
import { meowAIModel, fallbackAIModel } from '@/lib/firebase/ai';

vi.mock('@/lib/firebase/ai', () => ({
  meowAIModel: { generateContent: vi.fn() },
  fallbackAIModel: { generateContent: vi.fn() },
}));

const busy = new Error('AI: Error fetching from https://example.test: [500 ] This model is currently experiencing high demand.');
const request = { context: 'Question with options and answer', message: 'What is the fastest shortcut?', lang: 'en', history: [] };
const success = { response: { text: () => 'Use this shortcut.' } } as Awaited<ReturnType<typeof meowAIModel.generateContent>>;

describe('Gemini capacity recovery', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('recovers from the actual SDK timeout error via fallback', async () => {
    const timeout = new DOMException('Timeout has expired.', 'AbortError');
    vi.mocked(meowAIModel.generateContent).mockRejectedValue(timeout);
    vi.mocked(fallbackAIModel.generateContent).mockResolvedValue(success);
    const pending = requestGeminiTutor(request);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe('Use this shortcut.');
    expect(meowAIModel.generateContent).toHaveBeenCalledTimes(2);
    expect(fallbackAIModel.generateContent).toHaveBeenCalledTimes(1);
    expect(geminiErrorMessage(timeout)).toContain('GEMINI_TIMEOUT');
  });

  it('reads the SDK customErrorData field and distinguishes access from capacity', () => {
    expect(getGeminiFailure({ code: 'fetch-error', customErrorData: { status: 503 } })).toEqual({ kind: 'busy', status: 503 });
    expect(geminiErrorMessage({ code: 'fetch-error', customErrorData: { status: 403 } })).toContain('GEMINI_ACCESS_403');
    expect(geminiErrorMessage({ code: 'appCheck/fetch-status-error' })).toContain('GEMINI_ACCESS');
    expect(geminiErrorMessage({ code: 'error', message: 'Failed to fetch' })).toContain('GEMINI_NETWORK');
  });

  it('retries primary and falls back with the identical question request', async () => {
    vi.mocked(meowAIModel.generateContent).mockRejectedValue(busy);
    vi.mocked(fallbackAIModel.generateContent).mockResolvedValue(success);
    const onModelUsed = vi.fn();
    const pending = requestGeminiTutor({ ...request, onModelUsed });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe('Use this shortcut.');
    expect(meowAIModel.generateContent).toHaveBeenCalledTimes(2);
    expect(fallbackAIModel.generateContent).toHaveBeenCalledTimes(1);
    expect(fallbackAIModel.generateContent).toHaveBeenCalledWith(vi.mocked(meowAIModel.generateContent).mock.calls[0][0]);
    expect(onModelUsed).toHaveBeenCalledWith('gemini-3.7-flash');
  });

  it('stops after the bounded attempts when both models are busy', async () => {
    vi.mocked(meowAIModel.generateContent).mockRejectedValue(busy);
    vi.mocked(fallbackAIModel.generateContent).mockRejectedValue(busy);
    const pending = requestGeminiTutor(request).catch(error => error);
    await vi.runAllTimersAsync();
    expect(await pending).toBe(busy);
    expect(meowAIModel.generateContent).toHaveBeenCalledTimes(2);
    expect(fallbackAIModel.generateContent).toHaveBeenCalledTimes(1);
    expect(geminiErrorMessage(busy)).toContain('Gemini is busy');
    expect(geminiErrorMessage(busy)).not.toContain('https://');
  });

  it.each([400, 401, 403, 404, 429])('does not retry or switch models for HTTP %s', async (status) => {
    const error = Object.assign(new Error(`Request failed: [${status}]`), { customData: { status } });
    vi.mocked(meowAIModel.generateContent).mockRejectedValue(error);
    await expect(requestGeminiTutor(request)).rejects.toBe(error);
    expect(meowAIModel.generateContent).toHaveBeenCalledTimes(1);
    expect(fallbackAIModel.generateContent).not.toHaveBeenCalled();
  });

  it('retries a selected fallback without switching back to primary', async () => {
    vi.mocked(fallbackAIModel.generateContent).mockRejectedValueOnce(busy).mockResolvedValueOnce(success);
    const pending = requestGeminiTutor({ ...request, model: 'gemini-3.7-flash' });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe('Use this shortcut.');
    expect(meowAIModel.generateContent).not.toHaveBeenCalled();
    expect(fallbackAIModel.generateContent).toHaveBeenCalledTimes(2);
  });
});
