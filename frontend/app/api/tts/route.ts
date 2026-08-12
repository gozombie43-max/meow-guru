import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, bengaliText, voice = "en-IN-NeerjaNeural", rate = "0%" } = await req.json();

  const key = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION || "centralindia";

  if (!key) {
    return NextResponse.json({ error: "Azure TTS key not configured" }, { status: 500 });
  }

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  let ssml = `
<speak version='1.0' xml:lang='en-IN'>
  <voice xml:lang='en-IN' name='${voice}'>
    <prosody rate='${rate}'>
      ${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </prosody>
  </voice>`;

  if (bengaliText && typeof bengaliText === "string") {
    ssml += `
  <voice xml:lang='bn-IN' name='bn-IN-TanishaaNeural'>
    <prosody rate='${rate}'>
      ${bengaliText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </prosody>
  </voice>`;
  }

  ssml += `
</speak>`;

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
    }
  );

  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text();
    return NextResponse.json({ error: errText }, { status: ttsResponse.status });
  }

  const audioBuffer = await ttsResponse.arrayBuffer();

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
