import { NextRequest, NextResponse } from "next/server";
import { authorizeAiRequest, releaseAiRequest } from "@/lib/server/ai-route-security";

const VOICES = new Set(["en-IN-NeerjaNeural", "en-IN-PrabhatNeural"]);
const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function handlePost(req: NextRequest) {
  const authError = await authorizeAiRequest(req, 30);
  if (authError) return authError;

  const body = await req.json().catch(() => null) as {
    text?: unknown;
    bengaliText?: unknown;
    voice?: unknown;
    rate?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const bengaliText = typeof body?.bengaliText === "string" ? body.bengaliText.trim() : "";
  const voice = typeof body?.voice === "string" && VOICES.has(body.voice)
    ? body.voice
    : "en-IN-NeerjaNeural";
  const rate = typeof body?.rate === "string" && /^(?:-?(?:[0-9]|1[0-9]|20))%$/.test(body.rate)
    ? body.rate
    : "0%";

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > 5_000 || bengaliText.length > 5_000) {
    return NextResponse.json({ error: "Speech text is too long" }, { status: 413 });
  }

  const key = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION || "centralindia";
  if (!key) {
    return NextResponse.json({ error: "Text-to-speech is not configured" }, { status: 503 });
  }

  let ssml = `
<speak version='1.0' xml:lang='en-IN'>
  <voice xml:lang='en-IN' name='${voice}'>
    <prosody rate='${rate}'>${escapeXml(text)}</prosody>
  </voice>`;

  if (bengaliText) {
    ssml += `
  <voice xml:lang='bn-IN' name='bn-IN-TanishaaNeural'>
    <prosody rate='${rate}'>${escapeXml(bengaliText)}</prosody>
  </voice>`;
  }
  ssml += "\n</speak>";

  const ttsResponse = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
        "User-Agent": "QuizGuru",
      },
      body: ssml,
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!ttsResponse.ok) {
    return NextResponse.json({ error: "Text-to-speech failed" }, { status: 502 });
  }

  return new NextResponse(await ttsResponse.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function POST(req: NextRequest) {
  try { return await handlePost(req); }
  catch { return NextResponse.json({ error: 'AI service unavailable. Please retry.' }, { status: 502 }); }
  finally { await releaseAiRequest(req); }
}
