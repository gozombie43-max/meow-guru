// ─────────────────────────────────────────────
//  useDiagramFromAI.ts
//  Hook: question text → GeometryDiagram JSON
//  via your Azure OpenAI / GPT-5.5 endpoint.
//
//  Usage:
//    const { diagram, loading, error } = useDiagramFromAI(question.text)
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import type { GeometryDiagram } from "./diagramSchema";
import { SYSTEM_PROMPT } from "./diagramPrompt";

// ── API call ──────────────────────────────────
async function fetchDiagram(questionText: string): Promise<GeometryDiagram> {
  // Path A: Use your Next.js API route (recommended — keeps keys server-side)
  const res = await fetch("/api/diagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: questionText }),
  });

  if (!res.ok) throw new Error(`Diagram API error: ${res.status}`);
  const data = await res.json();
  return data as GeometryDiagram;
}

// ── hook ──────────────────────────────────────
export function useDiagramFromAI(questionText: string | null) {
  const [diagram, setDiagram]   = useState<GeometryDiagram | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const cache = useRef<Map<string, GeometryDiagram>>(new Map());

  useEffect(() => {
    if (!questionText) return;

    // cache hit
    if (cache.current.has(questionText)) {
      setDiagram(cache.current.get(questionText)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDiagram(questionText)
      .then(d => {
        if (cancelled) return;
        cache.current.set(questionText, d);
        setDiagram(d);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [questionText]);

  return { diagram, loading, error };
}

// ─────────────────────────────────────────────
//  Next.js API route  →  app/api/diagram/route.ts
//  (copy this into your app)
// ─────────────────────────────────────────────
export const DIAGRAM_API_ROUTE = `
// app/api/diagram/route.ts
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = \`${SYSTEM_PROMPT}\`;

export async function POST(req: NextRequest) {
  const { question } = await req.json();

  // ── Option A: Azure OpenAI ────────────────────
  const endpoint  = process.env.AZURE_OPENAI_ENDPOINT!;   // from .env.local
  const apiKey    = process.env.AZURE_OPENAI_KEY!;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5-5";

  const azureRes = await fetch(
    \`\${endpoint}/openai/deployments/\${deployment}/chat/completions?api-version=2024-02-01\`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: question },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    }
  );

  if (!azureRes.ok) {
    return NextResponse.json({ error: "Azure OpenAI error" }, { status: 500 });
  }

  const raw = await azureRes.json();
  const text = raw.choices[0].message.content.trim();

  try {
    const diagram = JSON.parse(text);
    return NextResponse.json(diagram);
  } catch {
    return NextResponse.json({ error: "Invalid JSON from AI", raw: text }, { status: 500 });
  }
}
`;

export { SYSTEM_PROMPT };
