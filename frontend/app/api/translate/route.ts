import { NextRequest, NextResponse } from "next/server";
import { authorizeAiRequest, releaseAiRequest } from "@/lib/server/ai-route-security";

const SUPPORTED_LANGUAGES = new Set(["hi", "bn"]);

async function handlePost(req: NextRequest) {
  const authError = await authorizeAiRequest(req, 40);
  if (authError) return authError;

  const body = await req.json().catch(() => null) as {
    texts?: unknown;
    targetLang?: unknown;
  } | null;
  const texts = body?.texts;
  const targetLang = body?.targetLang;

  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > 20 ||
    texts.some((text) => typeof text !== "string" || !text.trim() || text.length > 2_000) ||
    texts.reduce((total, text) => total + String(text).length, 0) > 10_000 ||
    typeof targetLang !== "string" ||
    !SUPPORTED_LANGUAGES.has(targetLang)
  ) {
    return NextResponse.json({ error: "Invalid translation request" }, { status: 400 });
  }

  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION || "eastasia";
  if (!key) {
    return NextResponse.json({ error: "Translation is not configured" }, { status: 503 });
  }

  const response = await fetch(
    `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=${targetLang}`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(texts.map((text) => ({ text }))),
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Translation failed" }, { status: 502 });
  }
  return NextResponse.json(await response.json());
}

export async function POST(req: NextRequest) {
  try { return await handlePost(req); }
  catch { return NextResponse.json({ error: 'AI service unavailable. Please retry.' }, { status: 502 }); }
  finally { await releaseAiRequest(req); }
}
