"use client";

/**
 * MathRenderer.tsx  — SSC CGL Math Expression Renderer
 * ──────────────────────────────────────────────────────────────────────────────
 * Custom tokeniser — no KaTeX dependency needed.
 *
 * Supports:
 *   Fractions        : (√5−√3)/(√5+√3), a/b, (x+1)/(x-1)
 *   Square roots     : √5, √(a+b), √(x²+y²)
 *   Superscripts     : x², x^3, x^(2n+1), x^(-1)
 *   Subscripts       : x₁, x_1, x_(n+1)
 *   Nested           : √(x^2+1), (√3+1)^2, (a/b)^n
 *   Unicode nums     : ² ³ ½ ₁ ₂ etc.
 *   Greek / symbols  : α β π ∞ ≤ ≥ ± → rendered as-is
 *   Mixed text       : "If x = (√5−√3)/(√5+√3) find x³ + 1/x³"
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Token =
  | { type: "text"; value: string }
  | { type: "fraction"; num: string; den: string }
  | { type: "sqrt"; radicand: string }
  | { type: "sup"; exp: string }
  | { type: "sub"; sub: string };

interface MathRendererProps {
  text: string;
  className?: string;
  /** When true, renders fragment only (no wrapper span) — for recursive use */
  inline?: boolean;
}

// ─── Group matcher ────────────────────────────────────────────────────────────

function matchGroup(str: string, pos: number): [string, number] {
  if (pos >= str.length) return ["", pos];

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
    return [str.slice(pos + 1), str.length];
  }

  const cp = str.codePointAt(pos)!;
  const char = String.fromCodePoint(cp);
  return [char, pos + char.length];
}

// ─── Numerator extractor ──────────────────────────────────────────────────────

function extractNumerator(buf: string): [string, string] {
  if (!buf) return ["", ""];

  if (buf.endsWith(")")) {
    let depth = 0;
    let j = buf.length - 1;
    while (j >= 0) {
      if (buf[j] === ")") depth++;
      else if (buf[j] === "(") {
        depth--;
        if (depth === 0) {
          return [buf.slice(0, j), buf.slice(j + 1, buf.length - 1)];
        }
      }
      j--;
    }
  }

  // Grab last word token (letters, digits, unicode math)
  const m = buf.match(/^([\s\S]*?)([\w\u00B2-\u00BE\u2070-\u209F\u03B1-\u03C9\u2200-\u22FF]+)$/);
  if (m) return [m[1], m[2]];

  return ["", buf];
}

// ─── Tokeniser ────────────────────────────────────────────────────────────────

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

    // ── √ square root ─────────────────────────────────────────────────────────
    if (ch === "√") {
      flush();
      i++;
      const [radicand, end] = matchGroup(input, i);
      tokens.push({ type: "sqrt", radicand });
      i = end;
      continue;
    }

    // ── ^ superscript ─────────────────────────────────────────────────────────
    if (ch === "^") {
      flush();
      i++;
      const [exp, end] = matchGroup(input, i);
      tokens.push({ type: "sup", exp });
      i = end;
      continue;
    }

    // ── _ subscript ───────────────────────────────────────────────────────────
    if (ch === "_") {
      flush();
      i++;
      const [sub, end] = matchGroup(input, i);
      tokens.push({ type: "sub", sub });
      i = end;
      continue;
    }

    // ── / fraction ────────────────────────────────────────────────────────────
    if (ch === "/") {
      const nextCh = input[i + 1];

      const prevOk =
        buf.length > 0 ||
        (tokens.length > 0 &&
          ["sqrt", "sup", "sub"].includes(tokens[tokens.length - 1].type));
      const nextOk = nextCh !== undefined && /[\w(√\u221A\-\u2212]/.test(nextCh);

      if (prevOk && nextOk) {
        let num = "";
        let prefix = "";

        if (buf.length > 0) {
          [prefix, num] = extractNumerator(buf);
          buf = "";
        } else {
          // Numerator is the last token (e.g. √5 / √3)
          const lastTok = tokens.pop()!;
          if (lastTok.type === "sqrt") {
            num = `√(${lastTok.radicand})`;
          } else if (lastTok.type === "sup") {
            num = `^(${lastTok.exp})`;
          } else if (lastTok.type === "text") {
            [prefix, num] = extractNumerator(lastTok.value);
            if (prefix) tokens.push({ type: "text", value: prefix });
          } else {
            tokens.push(lastTok);
            buf += ch;
            i++;
            continue;
          }
        }

        if (prefix) tokens.push({ type: "text", value: prefix });

        i++; // skip '/'
        const [den, end] = matchGroup(input, i);
        tokens.push({ type: "fraction", num, den });
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

// ─── Unicode maps ─────────────────────────────────────────────────────────────

const UNICODE_SUP: Record<string, string> = {
  "\u2070": "0", "\u00B9": "1", "\u00B2": "2", "\u00B3": "3",
  "\u2074": "4", "\u2075": "5", "\u2076": "6", "\u2077": "7",
  "\u2078": "8", "\u2079": "9", "\u207B": "\u2212", "\u207A": "+",
  "\u207F": "n", "\u1D43": "a", "\u1D47": "b",
};

const UNICODE_SUB: Record<string, string> = {
  "\u2080": "0", "\u2081": "1", "\u2082": "2", "\u2083": "3",
  "\u2084": "4", "\u2085": "5", "\u2086": "6", "\u2087": "7",
  "\u2088": "8", "\u2089": "9",
};

const UNICODE_FRACS: Record<string, [string, string]> = {
  "\u00BD": ["1", "2"], "\u2153": ["1", "3"], "\u2154": ["2", "3"],
  "\u00BC": ["1", "4"], "\u00BE": ["3", "4"], "\u2155": ["1", "5"],
  "\u2156": ["2", "5"], "\u2157": ["3", "5"], "\u2158": ["4", "5"],
  "\u2159": ["1", "6"], "\u215A": ["5", "6"], "\u215B": ["1", "8"],
  "\u215C": ["3", "8"], "\u215D": ["5", "8"], "\u215E": ["7", "8"],
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const supStyle: React.CSSProperties = {
  fontSize: "0.68em",
  lineHeight: 0,
  verticalAlign: "super",
  fontWeight: 600,
  position: "relative",
  top: "-0.1em",
};

const subStyle: React.CSSProperties = {
  fontSize: "0.68em",
  lineHeight: 0,
  verticalAlign: "sub",
  fontWeight: 500,
};

// ─── Sub-expression renderer (recursive) ─────────────────────────────────────

function renderExpr(text: string): React.ReactNode {
  if (!text) return null;
  if (!/[√^_/\u00B2-\u00BE\u2070-\u209F\u00BD\u2153-\u215E]/.test(text)) {
    return text;
  }
  return <MathRenderer text={text} inline />;
}

// ─── Visual components ────────────────────────────────────────────────────────

function Fraction({ num, den }: { num: string; den: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        verticalAlign: "middle",
        lineHeight: 1.1,
        margin: "0 2px",
      }}
    >
      <span style={{ fontSize: "0.82em", fontWeight: 600, padding: "0 3px", lineHeight: 1.3 }}>
        {renderExpr(num)}
      </span>
      <span
        style={{
          display: "block",
          width: "100%",
          minWidth: "1.4em",
          borderTop: "1.5px solid currentColor",
        }}
      />
      <span style={{ fontSize: "0.82em", fontWeight: 600, padding: "0 3px", lineHeight: 1.3 }}>
        {renderExpr(den)}
      </span>
    </span>
  );
}

function Sqrt({ radicand }: { radicand: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        verticalAlign: "middle",
        lineHeight: 1,
        margin: "0 1px",
      }}
    >
      <span
        style={{
          fontSize: "1.18em",
          lineHeight: 1,
          marginRight: "-2px",
          userSelect: "none",
          position: "relative",
          top: "0.04em",
        }}
      >
        √
      </span>
      <span
        style={{
          borderTop: "1.5px solid currentColor",
          paddingTop: "1px",
          paddingLeft: "1px",
          paddingRight: "2px",
          display: "inline-block",
          lineHeight: 1.25,
          fontSize: "0.93em",
        }}
      >
        {renderExpr(radicand)}
      </span>
    </span>
  );
}

function Sup({ exp }: { exp: string }) {
  return <sup style={supStyle}>{renderExpr(exp)}</sup>;
}

function Sub({ sub }: { sub: string }) {
  return <sub style={subStyle}>{renderExpr(sub)}</sub>;
}

// ─── Unicode script normaliser ────────────────────────────────────────────────

function renderUnicodeScripts(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let buf = "";
  let i = 0;

  function flushBuf() {
    if (buf) {
      result.push(<React.Fragment key={result.length}>{buf}</React.Fragment>);
      buf = "";
    }
  }

  while (i < text.length) {
    const ch = text[i];

    if (UNICODE_FRACS[ch]) {
      flushBuf();
      const [n, d] = UNICODE_FRACS[ch];
      result.push(<Fraction key={result.length} num={n} den={d} />);
      i++;
      continue;
    }

    if (UNICODE_SUP[ch]) {
      flushBuf();
      let supStr = "";
      while (i < text.length && UNICODE_SUP[text[i]]) {
        supStr += UNICODE_SUP[text[i]];
        i++;
      }
      result.push(
        <sup key={result.length} style={supStyle}>
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
        <sub key={result.length} style={subStyle}>
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function MathRenderer({
  text,
  className = "",
  inline = false,
}: MathRendererProps) {
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
        const parts = renderUnicodeScripts(tok.value);
        return <React.Fragment key={idx}>{parts}</React.Fragment>;
      }
    }
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