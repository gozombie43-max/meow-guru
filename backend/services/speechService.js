import { translationResponseSchema } from '@meow/contracts/speech';
import { aiProvider } from '../infrastructure/dependencyBoundary.js';

const escapeXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unavailable = message => Object.assign(new Error(message), { statusCode: 503 });
const failed = message => Object.assign(new Error(message), { statusCode: 502 });

export async function synthesizeSpeech({ text, bengaliText, voice, rate }) {
  const key = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION || 'centralindia';
  if (!key) throw unavailable('Text-to-speech is not configured');
  if (!/^[a-z0-9-]+$/i.test(region)) throw unavailable('Invalid speech region');
  const ssml = `<speak version='1.0' xml:lang='en-IN'><voice xml:lang='en-IN' name='${voice}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice>${bengaliText ? `<voice xml:lang='bn-IN' name='bn-IN-TanishaaNeural'><prosody rate='${rate}'>${escapeXml(bengaliText)}</prosody></voice>` : ''}</speak>`;
  return aiProvider.execute(async signal => {
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'MeowGuru' },
      body: ssml, signal,
    });
    if (!response.ok) throw failed('Text-to-speech failed');
    return Buffer.from(await response.arrayBuffer());
  }, { timeoutMs: 20000 });
}

export async function translateTexts({ texts, targetLang }) {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  if (!key) throw unavailable('Translation is not configured');
  return aiProvider.execute(async signal => {
    const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=${targetLang}`, {
      method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': process.env.AZURE_TRANSLATOR_REGION || 'eastasia', 'Content-Type': 'application/json' },
      body: JSON.stringify(texts.map(text => ({ text }))), signal,
    });
    if (!response.ok) throw failed('Translation failed');
    const parsed = translationResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.length !== texts.length || parsed.data.some(row => row.translations.some(value => value.to !== targetLang))) {
      throw failed('Invalid translation response');
    }
    return parsed.data;
  }, { timeoutMs: 20000 });
}
