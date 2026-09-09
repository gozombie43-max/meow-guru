import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/components/geometry/diagramPrompt";
import { authorizeAiRequest, releaseAiRequest } from "@/lib/server/ai-route-security";

function parseDiagramJson(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(withoutFence);
}

async function handlePost(req: NextRequest) {
  const authError = await authorizeAiRequest(req, 20);
  if (authError) return authError;

  const body = await req.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "Question text is required" }, { status: 400 });
  }
  if (question.length > 4_000) {
    return NextResponse.json({ error: "Question text is too long" }, { status: 413 });
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5-5";

  if (!endpoint || !apiKey) {
    return NextResponse.json(
      { error: "Diagram AI is not configured" },
      { status: 500 }
    );
  }

  const azureRes = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!azureRes.ok) {
    return NextResponse.json(
      { error: "Diagram generation failed" },
      { status: 502 }
    );
  }

  const raw = await azureRes.json();
  const text = raw?.choices?.[0]?.message?.content;

  if (typeof text !== "string") {
    return NextResponse.json(
      { error: "AI response did not include diagram JSON" },
      { status: 500 }
    );
  }

  try {
    return NextResponse.json(parseDiagramJson(text));
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON from AI" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try { return await handlePost(req); }
  catch { return NextResponse.json({ error: 'AI service unavailable. Please retry.' }, { status: 502 }); }
  finally { await releaseAiRequest(req); }
}
