import React from "react";
import MathText from "@/components/MathText";

type ContentPart =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; src: string };

type RichContentProps = {
  text: string;
  className?: string;
  renderText?: (line: string) => React.ReactNode;
};

const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

function resolveImageSrc(src: string): string {
  const trimmed = (src || "").trim();
  if (!trimmed) return "";
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;

  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}

function splitContent(text: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    parts.push({ type: "image", alt: match[1] || "", src: match[2] || "" });
    lastIndex = imageRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

function renderTextWithBreaks(text: string, renderLine: (line: string) => React.ReactNode, keyPrefix: string) {
  const lines = text.split(/\n/);
  return lines.map((line, index) => (
    <React.Fragment key={`${keyPrefix}-${index}`}>
      {line ? renderLine(line) : null}
      {index < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}

export default function RichContent({
  text,
  className = "",
  renderText,
}: RichContentProps) {
  if (!text) return null;

  const hasImage = /!\[[^\]]*\]\([^)]+\)/.test(text);
  const hasLineBreak = text.includes("\n");
  const renderLine = renderText ?? ((line: string) => <MathText text={line} />);

  if (!hasImage && !hasLineBreak) {
    return <MathText text={text} className={className} />;
  }

  const parts = splitContent(text);

  return (
    <div className={className} style={{ display: "grid", gap: "0.5rem" }}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <span key={`text-${index}`}>
              {renderTextWithBreaks(part.value, renderLine, `line-${index}`)}
            </span>
          );
        }

        const resolvedSrc = resolveImageSrc(part.src);
        if (!resolvedSrc) return null;

        return (
          <img
            key={`img-${index}`}
            src={resolvedSrc}
            alt={part.alt || "Question image"}
            style={{
              width: "100%",
              maxWidth: "100%",
              height: "auto",
              borderRadius: "12px",
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
            loading="lazy"
          />
        );
      })}
    </div>
  );
}
