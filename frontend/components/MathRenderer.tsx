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
  // matches \[ ... \] and \( ... \)
  const regex = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: input.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: "display", content: match[1].trim() });
    } else if (match[2] !== undefined) {
      parts.push({ type: "inline", content: match[2].trim() });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    parts.push({ type: "text", content: input.slice(lastIndex) });
  }

  return parts;
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
      return <span key={i}>{part.content}</span>;
    }

    const html = katex.renderToString(part.content, {
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
            : undefined
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