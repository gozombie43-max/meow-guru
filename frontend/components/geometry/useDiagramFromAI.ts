import { requestResponse as fetch } from "@/shared/api/request";
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
import { getAccessToken } from "@/shared/api/client";

// ── API call ──────────────────────────────────
async function fetchDiagram(questionText: string): Promise<GeometryDiagram> {
  // Path A: Use your Next.js API route (recommended — keeps keys server-side)
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error("Authentication required");
  const res = await fetch("/api/diagram", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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

export { SYSTEM_PROMPT };
