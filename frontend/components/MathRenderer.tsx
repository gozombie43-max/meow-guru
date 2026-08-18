"use client";

import React from "react";
import katex from "katex";

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

type Part =
  | { type: "text"; content: string }
  | { type: "inline"; content: string }
  | { type: "display"; content: string };

// LRU/Map Caches for string parsing and KaTeX HTML rendering
const MAX_CACHE_SIZE = 2500;
const partsCache = new Map<string, Part[]>();
const katexHtmlCache = new Map<string, string>();

function parseParts(input: string): Part[] {
  if (partsCache.has(input)) {
    return partsCache.get(input)!;
  }

  const parts: Part[] = [];
  // Normalize repeated backslashes so delimiters like \( ... \) are detected reliably
  const normalizedBackslashes = input.replace(/\\{2,}/g, "\\");
  const safeInput = normalizedBackslashes.replace(/\\\$/g, "__DOLLAR__");
  const regex = /\\+\[([\s\S]*?)\\+\]|\\+\(([\s\S]*?)\\+\)|\$\$([\s\S]*?)\$\$|\$([^\n$]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(safeInput)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: safeInput.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: "display", content: match[1].trim() });
    } else if (match[2] !== undefined) {
      parts.push({ type: "inline", content: match[2].trim() });
    } else if (match[3] !== undefined) {
      parts.push({ type: "display", content: match[3].trim() });
    } else if (match[4] !== undefined) {
      parts.push({ type: "inline", content: match[4].trim() });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < safeInput.length) {
    parts.push({ type: "text", content: safeInput.slice(lastIndex) });
  }

  const result = parts.map((part) => ({
    ...part,
    content: part.content.replace(/__DOLLAR__/g, "$"),
  }));

  if (partsCache.size > MAX_CACHE_SIZE) {
    partsCache.clear();
  }
  partsCache.set(input, result);

  return result;
}

function renderKatexSafe(content: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? "D" : "I"}:${content}`;
  if (katexHtmlCache.has(cacheKey)) {
    return katexHtmlCache.get(cacheKey)!;
  }

  try {
    const html = katex.renderToString(content, {
      throwOnError: false,
      displayMode,
      trust: false,
    });
    if (katexHtmlCache.size > MAX_CACHE_SIZE) {
      katexHtmlCache.clear();
    }
    katexHtmlCache.set(cacheKey, html);
    return html;
  } catch {
    return content;
  }
}

const MathRenderer = React.memo(function MathRenderer({
  text,
  className = "",
  inline = false,
}: MathRendererProps) {
  if (!text) return null;

  const parts = parseParts(text);

  const rendered = parts.map((part, i) => {
    if (part.type === "text") {
      const fracRegex = /\(?[^\s\/=()]+\)?\s*\/\s*\(?[^\s\/=()]+\)?/g;
      const nodes: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = fracRegex.exec(part.content)) !== null) {
        const idx = match.index;
        if (idx > lastIndex) nodes.push(<span key={`${i}-t-${lastIndex}`}>{part.content.slice(lastIndex, idx)}</span>);
        const frac = match[0];
        const partsFrac = frac.split('/');
        const rawNum = partsFrac[0].trim().replace(/^\(|\)$/g, '');
        let rawDen = partsFrac.slice(1).join('/').trim().replace(/^\(|\)$/g, '');
        const hasPercent = rawDen.endsWith('%');
        if (hasPercent) rawDen = rawDen.slice(0, -1).trim();
        const html = renderKatexSafe(`\\tfrac{${rawNum}}{${rawDen}}`, false);
        nodes.push(
          <span key={`${i}-f-${idx}`} dangerouslySetInnerHTML={{ __html: html }} />
        );
        if (hasPercent) nodes.push(<span key={`${i}-f-pct-${idx}`}>%</span>);
        lastIndex = fracRegex.lastIndex;
      }
      if (lastIndex < part.content.length) nodes.push(<span key={`${i}-t-last`}>{part.content.slice(lastIndex)}</span>);
      return <span key={i}>{nodes}</span>;
    }

    const mathContent = part.content.replace(/(\d+)\s*\/\s*(\d+)/g, "\\tfrac{$1}{$2}");
    const html = renderKatexSafe(mathContent, part.type === "display");

    return (
      <span
        key={i}
        dangerouslySetInnerHTML={{ __html: html }}
        style={
          part.type === "display"
            ? { display: "block", textAlign: "center", margin: "0.5em 0" }
            : { display: "inline-block", marginLeft: "0.22em", marginRight: "0.22em" }
        }
      />
    );
  });

  if (inline) return <>{rendered}</>;

  return (
    <span
      className={`math-text inline leading-relaxed ${className}`}
      style={{ wordBreak: "break-word" }}
    >
      {rendered}
    </span>
  );
});

export default MathRenderer;