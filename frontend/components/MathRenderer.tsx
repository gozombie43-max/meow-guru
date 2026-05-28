"use client";

import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean; // kept for backward compatibility
}

type Part =
  | { type: "text"; content: string }
  | { type: "inline"; content: string }
  | { type: "display"; content: string };

function parseParts(input: string): Part[] {
  const parts: Part[] = [];
    // Normalize repeated backslashes (e.g. "\\\\(" or "\\(") to a single backslash
    // so delimiters like \( ... \) are detected reliably even when double-escaped in JSON.
    const normalizedBackslashes = input.replace(/\\{2,}/g, "\\");
    const safeInput = normalizedBackslashes.replace(/\\\$/g, "__DOLLAR__");
    // Accept delimiters with one or more backslashes, e.g. \(...\), \\\(...\\\), $$...$$, and $...$
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

  return parts.map((part) => ({
    ...part,
    content: part.content.replace(/__DOLLAR__/g, "$"),
  }));
}

export default function MathRenderer({
  text,
  className = "",
  inline = false,
}: MathRendererProps) {
  if (!text) return null;

  const parts = parseParts(text);

  const rendered = parts.map((part, i) => {
    if (part.type === "text") {
      // Render plain text but detect simple inline fractions like 3/4 or x/100
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
        try {
          const html = katex.renderToString(`\\tfrac{${rawNum}}{${rawDen}}`, { throwOnError: false, displayMode: false });
          nodes.push(
            <span key={`${i}-f-${idx}`} dangerouslySetInnerHTML={{ __html: html }} />
          );
          if (hasPercent) nodes.push(<span key={`${i}-f-pct-${idx}`}>%</span>);
        } catch {
          nodes.push(<span key={`${i}-f-fallback-${idx}`}>{frac}</span>);
        }
        lastIndex = fracRegex.lastIndex;
      }
      if (lastIndex < part.content.length) nodes.push(<span key={`${i}-t-last`}>{part.content.slice(lastIndex)}</span>);
      return <span key={i}>{nodes}</span>;
    }

    // Fallback: convert simple ASCII numeric fractions (e.g. 3/4) into \tfrac{3}{4}
    // so they render like a math-book fraction. Only apply inside math parts.
    const mathContent = part.content.replace(/(\d+)\s*\/\s*(\d+)/g, "\\tfrac{$1}{$2}");

    const html = katex.renderToString(mathContent, {
      throwOnError: false,
      displayMode: part.type === "display",
      trust: false,
    });

    return (
      <span
        key={i}
        dangerouslySetInnerHTML={{ __html: html }}
        style={
          part.type === "display"
            ? { display: "block", textAlign: "center", margin: "0.5em 0" }
            : // add small horizontal spacing for inline math so it doesn't stick to text
              { display: "inline-block", marginLeft: "0.22em", marginRight: "0.22em" }
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
}