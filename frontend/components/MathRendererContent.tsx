"use client";

import { createStandaloneNumericFracRegex, hasSlashOutsideUrls, splitContentUrls } from './content-urls';
import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

type Part =
  | { type: "text"; content: string }
  | { type: "inline"; content: string }
  | { type: "display"; content: string };

import { BARE_MATH, containsMathSyntax } from "./math-syntax";

// LRU/Map Caches for string parsing and KaTeX HTML rendering
const MAX_CACHE_SIZE = 2500;
const partsCache = new Map<string, Part[]>();
const katexHtmlCache = new Map<string, string>();

function parseParts(input: string): Part[] {
  if (partsCache.has(input)) {
    return partsCache.get(input)!;
  }

  const parts: Part[] = [];
  // Match stored delimiters without collapsing genuine LaTeX row separators.
  const safeInput = input.replace(/\\\$/g, "__DOLLAR__");
  const regex = /\\+\[([\s\S]*?)\\+\]|\\+\(([\s\S]*?)\\+\)|\$\$([\s\S]*?)\$\$|\$([^\n$]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(safeInput)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: safeInput.slice(lastIndex, match.index) });
    }
    // A double-escaped delimiter means its contents were escaped too. Decode
    // pairs once, preserving encoded row separators (four slashes become two).
    const encoded = (match[0].match(/^\\+/)?.[0].length ?? 0) > 1;
    const mathContent = (value: string) => (encoded ? value.replace(/\\\\/g, "\\") : value).trim();
    if (match[1] !== undefined) {
      parts.push({ type: "display", content: mathContent(match[1]) });
    } else if (match[2] !== undefined) {
      parts.push({ type: "inline", content: mathContent(match[2]) });
    } else if (match[3] !== undefined) {
      parts.push({ type: "display", content: mathContent(match[3]) });
    } else if (match[4] !== undefined) {
      parts.push({ type: "inline", content: mathContent(match[4]) });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < safeInput.length) {
    parts.push({ type: "text", content: safeInput.slice(lastIndex) });
  }

  const expanded = parts.flatMap((part): Part[] => {
    if (part.type !== "text") return [part];
    return splitContentUrls(part.content).flatMap((segment): Part[] => {
      if (segment.isUrl) return [{ type: 'text', content: segment.text }];
      const content = segment.text.replace(/\\{2,}/g, "\\");
      const pieces: Part[] = [];
      let cursor = 0;
      for (const match of content.matchAll(new RegExp(BARE_MATH, "g"))) {
        const index = match.index;
        if (index > cursor) pieces.push({ type: "text", content: content.slice(cursor, index) });
        pieces.push({ type: "inline", content: match[0] });
        cursor = index + match[0].length;
      }
      if (cursor < content.length) pieces.push({ type: "text", content: content.slice(cursor) });
      return pieces;
    });
  });
  const hasProse = expanded.some(part => part.type === "text" && /\p{L}/u.test(part.content));
  const result: Part[] = expanded.map((part) => {
    // Keep genuine equations and standalone/display math in KaTeX. Imported
    // numerals embedded in prose should use the sentence's font and weight.
    const proseNumber = hasProse && part.type === "inline"
      && /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\\?%)?$/.test(part.content);
    return {
      type: proseNumber ? "text" : part.type,
      content: proseNumber ? part.content.replace(/\\%/g, "%") : part.content.replace(/__DOLLAR__/g, "$"),
    };
  });

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

  // Prose slashes and dates do not need KaTeX.
  if (!containsMathSyntax(text) && !hasSlashOutsideUrls(text)) {
    return (
      <span
        className={`math-text inline leading-relaxed ${className}`}
        style={{ wordBreak: "break-word" }}
      >
        {text}
      </span>
    );
  }

  const parts = parseParts(text);

  const rendered = parts.map((part, i) => {
    if (part.type === "text") {
      if (!hasSlashOutsideUrls(part.content)) {
        return <span key={i}>{part.content}</span>;
      }
      // Protect URLs and image paths; only format standalone numeric fractions.
      const textSegments = splitContentUrls(part.content);
      const nodes: React.ReactNode[] = [];

      textSegments.forEach((segment, segIdx) => {
        if (segment.isUrl || !hasSlashOutsideUrls(segment.text)) {
          nodes.push(<span key={`${i}-seg-${segIdx}`}>{segment.text}</span>);
          return;
        }
        const fracRegex = createStandaloneNumericFracRegex();
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = fracRegex.exec(segment.text)) !== null) {
          const idx = match.index;
          if (idx > lastIndex) nodes.push(<span key={`${i}-${segIdx}-t-${lastIndex}`}>{segment.text.slice(lastIndex, idx)}</span>);
          const rawNum = match[1].trim().replace(/^\(|\)$/g, '');
          const rawDen = match[2].trim().replace(/^\(|\)$/g, '');
          const hasPercent = match[0].endsWith('%');
          const html = renderKatexSafe(`\\tfrac{${rawNum}}{${rawDen}}`, false);
          nodes.push(
            <span key={`${i}-${segIdx}-f-${idx}`} dangerouslySetInnerHTML={{ __html: html }} />
          );
          if (hasPercent) nodes.push(<span key={`${i}-${segIdx}-f-pct-${idx}`}>%</span>);
          lastIndex = fracRegex.lastIndex;
        }
        if (lastIndex < segment.text.length) nodes.push(<span key={`${i}-${segIdx}-t-last`}>{segment.text.slice(lastIndex)}</span>);
      });

      return <span key={i}>{nodes}</span>;
    }

    // Do not split chained slashes or dates even inside explicit math.
    const mathContent = part.content.replace(/(?<!\/\s*)(?<![/\d])(\d+)\s*\/\s*(\d+)(?!\s*\/)(?![/\d])/g, "\\tfrac{$1}{$2}");
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
