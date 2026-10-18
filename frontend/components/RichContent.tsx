import React from "react";
import MathText from "@/components/MathText";
import QuestionImage from './QuestionImage';

type ContentPart =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; src: string };

type RichContentProps = {
  text: string;
  className?: string;
  renderText?: (line: string) => React.ReactNode;
  criticalImages?: boolean;
  imageDimensions?: { width?: number; height?: number };
  as?: 'div' | 'span';
};

// Tokenize complete URLs before deciding whether they identify an image. This
// avoids consuming only a prefix of a filename or treating ordinary links as images.
const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)|(?:https?:\/\/|\/(?:backend-api\/)?api\/upload\/image\/|\/(?:pyq-assets|images)\/)[^\s<>"')]+/gi;

function splitContent(text: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(imageRegex)) {
    const markdown = match[2] !== undefined;
    const src = markdown ? match[2].trim() : match[0].replace(/[.,;:!?]+$/, '');
    const path = src.split(/[?#]/, 1)[0].replace(/^https?:\/\/[^/]+/i, '');
    if (!markdown && !/\.(?:png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(path)
      && !/^\/(?:backend-api\/)?api\/upload\/image\//.test(path)) continue;
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    if (src) parts.push({ type: 'image', alt: match[1] || 'Question image', src });
    lastIndex = match.index + (markdown ? match[0].length : src.length);
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
  return parts;
}

const displayMathRegex = /\\+\[[\s\S]*?\\+\]|\$\$[\s\S]*?\$\$/g;

function renderTextWithBreaks(text: string, renderLine: (line: string) => React.ReactNode, keyPrefix: string) {
  if (!text) return null;
  // If text contains display math blocks with newlines, keep each display math block intact
  const tokens: Array<{ isDisplayMath: boolean; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(displayMathRegex.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ isDisplayMath: false, content: text.slice(lastIndex, match.index) });
    }
    tokens.push({ isDisplayMath: true, content: match[0] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ isDisplayMath: false, content: text.slice(lastIndex) });
  }

  return tokens.map((token, tokenIdx) => {
    if (token.isDisplayMath) {
      return (
        <React.Fragment key={`${keyPrefix}-dm-${tokenIdx}`}>
          {renderLine(token.content)}
        </React.Fragment>
      );
    }
    const lines = token.content.split(/\n/);
    return lines.map((line, index) => (
      <React.Fragment key={`${keyPrefix}-${tokenIdx}-${index}`}>
        {line ? renderLine(line) : null}
        {index < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    ));
  });
}

export default function RichContent({
  text,
  className = "",
  renderText,
  criticalImages = false,
  imageDimensions,
  as = 'div',
}: RichContentProps) {
  if (!text) return null;

  const parts = splitContent(text);
  const firstImageIndex = parts.findIndex(part => part.type === 'image');
  const hasImage = firstImageIndex !== -1;
  const hasLineBreak = text.includes("\n");
  const renderLine = renderText ?? ((line: string) => <MathText text={line} />);

  if (!hasImage && !hasLineBreak) {
    return renderText ? <span className={className}>{renderText(text)}</span> : <MathText text={text} className={className} />;
  }

  const Container = as;

  return (
    <Container className={className} style={{ display: as === 'span' ? 'inline-grid' : 'grid', gap: '0.5rem', width: '100%' }}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <span key={`text-${index}`}>
              {renderTextWithBreaks(part.value, renderLine, `line-${index}`)}
            </span>
          );
        }

        const src = part.src.trim();
        if (!src) return null;

        return (
          <QuestionImage
            key={`img-${index}`}
            src={src}
            alt={part.alt || "Question image"}
            width={imageDimensions?.width}
            height={imageDimensions?.height}
            critical={criticalImages && index === firstImageIndex}
            enableZoom={as !== 'span'}
            isOption={as === 'span'}
          />
        );
      })}
    </Container>
  );
}
