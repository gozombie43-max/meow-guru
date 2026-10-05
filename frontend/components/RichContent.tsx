import React from "react";
import MathText from "@/components/MathText";
import QuestionImage, { resolveQuestionImage } from './QuestionImage';

type ContentPart =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; src: string };

type RichContentProps = {
  text: string;
  className?: string;
  renderText?: (line: string) => React.ReactNode;
  criticalImages?: boolean;
  imageDimensions?: { width?: number; height?: number };
};

const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

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
  criticalImages = false,
  imageDimensions,
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

        const resolvedSrc = part.src.trim() ? resolveQuestionImage(part.src) : '';
        if (!resolvedSrc) return null;

        return (
          <QuestionImage
            key={`img-${index}`}
            src={resolvedSrc}
            alt={part.alt || "Question image"}
            width={imageDimensions?.width}
            height={imageDimensions?.height}
            critical={criticalImages && index === parts.findIndex(part => part.type === 'image')}
          />
        );
      })}
    </div>
  );
}
