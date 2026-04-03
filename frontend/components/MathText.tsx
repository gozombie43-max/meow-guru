import React from "react";
import MathRenderer from "@/components/MathRenderer";

type Props = { text: string; className?: string };

const fracRegex = /(\([^)]+\)|[^\s/()]+)\s*\/\s*(\([^)]+\)|[^\s/()]+)/g;

export default function MathText({ text, className = "" }: Props) {
  if (!text) return <span className={className} />;

  const parts: Array<
    | { type: "text"; value: string }
    | { type: "frac"; num: string; den: string }
  > = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fracRegex.exec(text)) !== null) {
    const idx = match.index;
    if (idx > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, idx) });
    parts.push({ type: "frac", num: match[1], den: match[2] });
    lastIndex = fracRegex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });

  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.type === "text") return <MathRenderer key={i} text={p.value} />;
        const num = p.num.replace(/^\(|\)$/g, "");
        let den = p.den.replace(/^\(|\)$/g, "");
        const percentSuffix = den.endsWith("%") ? "%" : "";
        if (percentSuffix) den = den.slice(0, -1).trim();

        return (
          <span key={i} className="inline-flex items-center gap-0.5 align-middle">
            <span className="inline-flex flex-col items-center leading-none" role="math">
              <span className="text-[var(--text-primary)] font-bold" style={{ fontSize: "0.85em" }}>
                <MathRenderer text={num} />
              </span>
              <span className="w-full border-t border-slate-400 my-[2px]" style={{ minWidth: "1.2em" }} />
              <span className="text-slate-500 font-semibold" style={{ fontSize: "0.85em" }}>
                <MathRenderer text={den} />
              </span>
            </span>
            {percentSuffix && (
              <span className="text-[var(--text-primary)] font-semibold" style={{ fontSize: "0.95em" }}>
                %
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
