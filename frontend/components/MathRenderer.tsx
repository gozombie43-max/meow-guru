"use client";

/**
 * MathRenderer.tsx
 * ─────────────────────────────────────────────────────────────────
 * Renders math-rich text for SSC CGL quiz questions.
 *
 * Supports (inline, no LaTeX delimiters needed in question strings):
 *   • Fractions        : (√5−√3)/(√5+√3)  →  stacked fraction
 *   • Square roots     : √5, √(a+b)        →  ✓ with overline
 *   • Superscripts     : x³, x^3, x^(2n)  →  raised small text
 *   • Subscripts       : x₁, x_1, x_(n+1) →  lowered small text
 *   • Negative powers  : x⁻¹, x^(-1)      →  raised −1
 *   • Unicode numerics : ² ³ ½ etc.        →  handled automatically
 *   • Greek / symbols  : α β π ∞ ≤ ≥ ±    →  rendered as-is (Unicode)
 *
 * Usage:
 *   <MathRenderer text="If x = (√5−√3)/(√5+√3) find x³ + y³" />
 * ─────────────────────────────────────────────────────────────────
 */

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Token =
  | { type: "text"; value: string }
  | { type: "fraction"; num: string; den: string }
  | { type: "sqrt"; radicand: string }
  | { type: "sup"; base: string; exp: string }
  | { type: "sub"; base: string; sub: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Match a possibly-parenthesised group starting at pos, return [content, endIndex] */
function matchGroup(str: string, pos: number): [string, number] {
  if (str[pos] === "(") {
    let depth = 0;
    let i = pos;
    while (i < str.length) {
      if (str[i] === "(") depth++;
      else if (str[i] === ")") {
        depth--;
        if (depth === 0) return [str.slice(pos + 1, i), i + 1];
      }
      i++;
    }
    // unmatched paren – treat rest as group
    return [str.slice(pos + 1), str.length];
  }
  // single char / unicode scalar
  // grab full unicode char (handles surrogate pairs)
  const cp = str.codePointAt(pos)!;
  const char = String.fromCodePoint(cp);
  return [char, pos + char.length];
}

/** Parse an expression (potentially multi-char) that acts as a numerator/denominator */
function matchExpr(str: string, pos: number): [string, number] {
  return matchGroup(str, pos);
}

// ── Tokeniser ─────────────────────────────────────────────────────────────────
function tokenise(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buf = "";

  function flush() {
    if (buf) {
      tokens.push({ type: "text", value: buf });
      buf = "";
    }
  }

  while (i < input.length) {
    const ch = input[i];

    // ── √  square root ───────────────────────────────────────────────────────
    if (ch === "√") {
      flush();
      i++;
      const [radicand, end] = matchGroup(input, i);
      tokens.push({ type: "sqrt", radicand });
      i = end;
      continue;
    }

    // ── ^ superscript ────────────────────────────────────────────────────────
    if (ch === "^") {
      flush();
      // Grab the immediately preceding "base" from the buffer tail
      // or just mark sup with empty base (we'll inline it)
      i++;
      const [exp, end] = matchGroup(input, i);
      tokens.push({ type: "sup", base: "", exp });
      i = end;
      continue;
    }

    // ── _ subscript ──────────────────────────────────────────────────────────
    if (ch === "_") {
      flush();
      i++;
      const [sub, end] = matchGroup(input, i);
      tokens.push({ type: "sub", base: "", sub });
      i = end;
      continue;
    }

    // ── / fraction  (only when surrounded by groups) ─────────────────────────
    // Pattern: <group>/<group>   where group = (expr) or single token
    // We look ahead: if the char before '/' ended a group/word and next starts one
    if (ch === "/") {
      // check if previous token in buf is a "group end" → fraction
      // Simple heuristic: if buf ends with ) or a word char, treat as fraction
      const prevOk = buf.length > 0 && /[\w)⁰¹²³⁴⁵⁶⁷⁸⁹½⅓⅔¼¾]$/.test(buf);
      const nextOk = i + 1 < input.length && /[\w(√]/.test(input[i + 1]);

      if (prevOk && nextOk) {
        // Numerator = last "group" in buf
        let num = buf;
        let prefix = "";
        if (buf.endsWith(")")) {
          // find matching (
          let depth = 0;
          let j = buf.length - 1;
          while (j >= 0) {
            if (buf[j] === ")") depth++;
            else if (buf[j] === "(") {
              depth--;
              if (depth === 0) break;
            }
            j--;
          }
          prefix = buf.slice(0, j);
          num = buf.slice(j + 1, buf.length - 1); // strip outer parens
        } else {
          // grab last word token
          const m = buf.match(/^([\s\S]*?)(\S+)$/);
          if (m) {
            prefix = m[1];
            num = m[2];
          }
        }

        // flush prefix
        if (prefix) tokens.push({ type: "text", value: prefix });
        buf = "";

        i++; // skip '/'
        const [den, end] = matchExpr(input, i);
        const cleanDen = den.replace(/^\(/, "").replace(/\)$/, ""); // strip outer parens
        tokens.push({ type: "fraction", num, den: cleanDen });
        i = end;
        continue;
      }
    }

    buf += ch;
    i++;
  }

  flush();
  return tokens;
}

// ── Render a sub-expression (recursively handles nested √, ^, _) ─────────────
function renderExpr(text: string): React.ReactNode {
  // Quick check – if no special chars, return plain
  if (!/[√^_/]/.test(text)) return text;
  return <MathRenderer text={text} inline />;
}

// ── Stacked Fraction ──────────────────────────────────────────────────────────
function Fraction({ num, den }: { num: string; den: string }) {
  return (
    <span
      className="inline-flex flex-col items-center align-middle leading-none mx-[2px]"
      style={{ verticalAlign: "middle" }}
    >
      <span className="text-[0.82em] font-semibold px-[2px] leading-tight">
        {renderExpr(num)}
      </span>
      <span
        className="w-full border-t border-current my-[2px]"
        style={{ minWidth: "1.4em" }}
      />
      <span className="text-[0.82em] font-semibold px-[2px] leading-tight">
        {renderExpr(den)}
      </span>
    </span>
  );
}

// ── Square Root ───────────────────────────────────────────────────────────────
function Sqrt({ radicand }: { radicand: string }) {
  return (
    <span className="inline-flex items-end leading-none align-middle mx-[1px]">
      {/* radical symbol */}
      <span
        className="font-normal select-none"
        style={{
          fontSize: "1.15em",
          lineHeight: 1,
          marginRight: "-1px",
          position: "relative",
          top: "0.05em",
        }}
      >
        √
      </span>
      {/* overline box */}
      <span
        style={{
          borderTop: "1.5px solid currentColor",
          paddingTop: "1px",
          paddingLeft: "1px",
          paddingRight: "2px",
          display: "inline-block",
          lineHeight: 1.2,
          fontSize: "0.92em",
        }}
      >
        {renderExpr(radicand)}
      </span>
    </span>
  );
}

// ── Superscript ───────────────────────────────────────────────────────────────
function Sup({ exp }: { exp: string }) {
  return (
    <sup
      style={{
        fontSize: "0.65em",
        lineHeight: 0,
        verticalAlign: "super",
        fontWeight: 600,
      }}
    >
      {renderExpr(exp)}
    </sup>
  );
}

// ── Subscript ─────────────────────────────────────────────────────────────────
function Sub({ sub }: { sub: string }) {
  return (
    <sub
      style={{
        fontSize: "0.65em",
        lineHeight: 0,
        verticalAlign: "sub",
        fontWeight: 500,
      }}
    >
      {renderExpr(sub)}
    </sub>
  );
}

// ── Unicode superscript / subscript normalisation ─────────────────────────────
// Converts ² ³ ¹ ⁻ etc. to <sup> and ₁ ₂ etc. to <sub>
const UNICODE_SUP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁻": "−", "⁺": "+", "ⁿ": "n",
};
const UNICODE_SUB: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

function renderUnicodeScripts(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let buf = "";
  let i = 0;

  function flushBuf() {
    if (buf) { result.push(buf); buf = ""; }
  }

  while (i < text.length) {
    const ch = text[i];
    if (UNICODE_SUP[ch]) {
      flushBuf();
      // collect consecutive superscript chars
      let supStr = "";
      while (i < text.length && UNICODE_SUP[text[i]]) {
        supStr += UNICODE_SUP[text[i]];
        i++;
      }
      result.push(
        <sup key={result.length} style={{ fontSize: "0.65em", lineHeight: 0, verticalAlign: "super", fontWeight: 600 }}>
          {supStr}
        </sup>
      );
      continue;
    }
    if (UNICODE_SUB[ch]) {
      flushBuf();
      let subStr = "";
      while (i < text.length && UNICODE_SUB[text[i]]) {
        subStr += UNICODE_SUB[text[i]];
        i++;
      }
      result.push(
        <sub key={result.length} style={{ fontSize: "0.65em", lineHeight: 0, verticalAlign: "sub", fontWeight: 500 }}>
          {subStr}
        </sub>
      );
      continue;
    }
    buf += ch;
    i++;
  }
  flushBuf();
  return result;
}

// ── Main Component ────────────────────────────────────────────────────────────
interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

export default function MathRenderer({ text, className = "", inline = false }: MathRendererProps) {
  if (!text) return null;

  const tokens = tokenise(text);

  const rendered = tokens.map((tok, idx) => {
    switch (tok.type) {
      case "fraction":
        return <Fraction key={idx} num={tok.num} den={tok.den} />;
      case "sqrt":
        return <Sqrt key={idx} radicand={tok.radicand} />;
      case "sup":
        return <Sup key={idx} exp={tok.exp} />;
      case "sub":
        return <Sub key={idx} sub={tok.sub} />;
      case "text": {
        // Handle unicode super/subscripts inside plain text
        const parts = renderUnicodeScripts(tok.value);
        return (
          <React.Fragment key={idx}>
            {parts.map((p, j) => (
              <React.Fragment key={j}>{p}</React.Fragment>
            ))}
          </React.Fragment>
        );
      }
    }
  });

  if (inline) {
    return <>{rendered}</>;
  }

  return (
    <span className={`math-text inline leading-relaxed ${className}`}>
      {rendered}
    </span>
  );
}