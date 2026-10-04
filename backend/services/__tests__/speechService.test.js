import { afterEach, expect, it, vi } from 'vitest';
import { synthesizeSpeech, translateTexts } from '../speechService.js';
vi.mock('../../infrastructure/dependencyBoundary.js', () => ({ aiProvider: { execute: work => work(new AbortController().signal) } }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('escapes speech markup and uses only the selected backend voice', async () => {
  vi.stubEnv('AZURE_TTS_KEY', 'test-key');
  const request = vi.fn().mockResolvedValue(new Response('mp3')); vi.stubGlobal('fetch', request);
  expect(await synthesizeSpeech({ text: '<script>&', bengaliText: 'বাংলা', voice: 'en-IN-NeerjaNeural', rate: '0%' })).toEqual(Buffer.from('mp3'));
  const options = request.mock.calls[0][1];
  expect(options.body).toContain('&lt;script&gt;&amp;'); expect(options.body).toContain('bn-IN-TanishaaNeural');
  expect(options.signal).toBeInstanceOf(AbortSignal);
});
it('fails clearly when provider configuration is absent', async () => {
  vi.stubEnv('AZURE_TTS_KEY', ''); vi.stubEnv('AZURE_TRANSLATOR_KEY', '');
  await expect(synthesizeSpeech({})).rejects.toMatchObject({ statusCode: 503 });
  await expect(translateTexts({})).rejects.toMatchObject({ statusCode: 503 });
});
it('checks translation shape, cardinality and target language', async () => {
  vi.stubEnv('AZURE_TRANSLATOR_KEY', 'test-key');
  const request = vi.fn(); vi.stubGlobal('fetch', request);
  for (const body of [{}, [], [{ translations: [{ text: 'bad', to: 'bn' }] }]]) {
    request.mockResolvedValueOnce(Response.json(body));
    await expect(translateTexts({ texts: ['hello'], targetLang: 'hi' })).rejects.toMatchObject({ statusCode: 502 });
  }
  request.mockResolvedValueOnce(new Response('', { status: 429 }));
  await expect(translateTexts({ texts: ['hello'], targetLang: 'hi' })).rejects.toMatchObject({ statusCode: 502 });
});
