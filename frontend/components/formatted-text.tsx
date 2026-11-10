import React from 'react';
import { splitContentUrls } from './content-urls';

/**
 * Matches Markdown bold syntax:
 * **text** or __text__
 *
 * Rules:
 * - Opening delimiter must not be followed by whitespace: (?!\s)
 * - Closing delimiter must not be preceded by whitespace: (?<!\s)
 * - Delimiters must not be empty (**** or ____)
 * - Single * or _ are allowed inside the bold text as long as they don't form ** or __
 */
export const BOLD_REGEX = /(?:\*\*(?!\s)((?:[^*]|\*(?!\*))+?)(?<!\s)\*\*|__(?!\s)((?:[^_]|_(?!_))+?)(?<!\s)__)/g;

export function hasMarkdownBold(text: string): boolean {
  if (!text || (!text.includes('**') && !text.includes('__'))) return false;
  const regex = new RegExp(BOLD_REGEX.source, 'g');
  return regex.test(text);
}

/**
 * Formats a plain string (without URLs or math delimiters)
 * with markdown bolding syntax into React nodes with <strong className="font-bold">.
 */
export function formatMarkdownBold(text: string, keyPrefix: string = 'b'): React.ReactNode[] {
  if (!text) return [];
  if (!text.includes('**') && !text.includes('__')) {
    return [text];
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(BOLD_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const boldContent = match[1] ?? match[2];
    nodes.push(
      <strong key={`${keyPrefix}-${match.index}`} className="font-bold">
        {boldContent}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Formats prose text:
 * 1. Protects URLs so filenames with underscores or asterisks remain intact.
 * 2. Parses markdown bold in all non-URL segments.
 */
export function renderFormattedProse(text: string, keyPrefix: string = 'p'): React.ReactNode {
  if (!text) return null;
  if (!text.includes('**') && !text.includes('__')) {
    return text;
  }

  const segments = splitContentUrls(text);
  if (segments.length === 1 && !segments[0].isUrl) {
    const nodes = formatMarkdownBold(segments[0].text, keyPrefix);
    return nodes.length === 1 && typeof nodes[0] === 'string' ? nodes[0] : <>{nodes}</>;
  }

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.isUrl) {
          return seg.text;
        }
        const nodes = formatMarkdownBold(seg.text, `${keyPrefix}-${idx}`);
        return <React.Fragment key={`${keyPrefix}-seg-${idx}`}>{nodes}</React.Fragment>;
      })}
    </>
  );
}

export type RenderablePart =
  | { type: "text"; content: string }
  | { type: "inline"; content: string }
  | { type: "display"; content: string };

function stripMatchedBold(content: string, delimiter: '**' | '__'): string {
  const pattern = delimiter === '**'
    ? /\*\*(?!\s)(?:[^*]|\*(?!\*))+?(?<!\s)\*\*/g
    : /__(?!\s)(?:[^_]|_(?!_))+?(?<!\s)__/g;
  return content.replace(pattern, '');
}

/**
 * Renders an array of parts (text + math), handling both intra-part bolding
 * and cross-part bolding (e.g. **$x = 2$** or **Step 1: Calculate $x$**).
 */
export function renderPartsWithBold(
  parts: RenderablePart[],
  renderMathPart: (part: RenderablePart, index: number) => React.ReactNode,
  renderTextContent: (content: string, keyPrefix: string) => React.ReactNode,
  keyPrefix: string = 'part'
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const mutableParts = parts.map(p => ({ ...p }));
  let i = 0;

  while (i < mutableParts.length) {
    const part = mutableParts[i];
    if (part.type !== 'text') {
      result.push(renderMathPart(part, i));
      i++;
      continue;
    }

    // Check if this text part has an unmatched opening delimiter (** or __)
    const hasUnmatchedAsterisk = stripMatchedBold(part.content, '**').includes('**');
    const hasUnmatchedUnderscore = !hasUnmatchedAsterisk && stripMatchedBold(part.content, '__').includes('__');
    const delimiter: '**' | '__' | null = hasUnmatchedAsterisk ? '**' : hasUnmatchedUnderscore ? '__' : null;

    if (!delimiter) {
      result.push(renderTextContent(part.content, `${keyPrefix}-${i}`));
      i++;
      continue;
    }

    // Find the opening delimiter in part[i]
    const openIdx = part.content.lastIndexOf(delimiter);
    const beforeOpen = part.content.slice(0, openIdx);
    const afterOpen = part.content.slice(openIdx + delimiter.length);

    // Look for matching closing delimiter in subsequent text parts
    let closePartIdx = -1;
    let closeIdx = -1;
    for (let j = i + 1; j < mutableParts.length; j++) {
      if (mutableParts[j].type === 'text') {
        const found = mutableParts[j].content.indexOf(delimiter);
        if (found !== -1) {
          closePartIdx = j;
          closeIdx = found;
          break;
        }
      }
    }

    if (closePartIdx === -1) {
      // No closing delimiter found across parts; render text normally
      result.push(renderTextContent(part.content, `${keyPrefix}-${i}`));
      i++;
      continue;
    }

    // Render anything before open delimiter
    if (beforeOpen) {
      result.push(renderTextContent(beforeOpen, `${keyPrefix}-${i}-pre`));
    }

    // Collect bold children
    const boldChildren: React.ReactNode[] = [];
    if (afterOpen) {
      boldChildren.push(renderTextContent(afterOpen, `${keyPrefix}-${i}-bstart`));
    }

    for (let k = i + 1; k < closePartIdx; k++) {
      const midPart = mutableParts[k];
      if (midPart.type === 'text') {
        boldChildren.push(renderTextContent(midPart.content, `${keyPrefix}-${k}`));
      } else {
        boldChildren.push(renderMathPart(midPart, k));
      }
    }

    const closePart = mutableParts[closePartIdx];
    const beforeClose = closePart.content.slice(0, closeIdx);
    const afterClose = closePart.content.slice(closeIdx + delimiter.length);

    if (beforeClose) {
      boldChildren.push(renderTextContent(beforeClose, `${keyPrefix}-${closePartIdx}-bend`));
    }

    result.push(
      <strong key={`${keyPrefix}-bold-${i}-${closePartIdx}`} className="font-bold">
        {boldChildren}
      </strong>
    );

    // If closePart had content after close delimiter, update closePart.content for subsequent processing
    if (afterClose) {
      mutableParts[closePartIdx] = { type: 'text', content: afterClose };
      i = closePartIdx;
    } else {
      i = closePartIdx + 1;
    }
  }

  return result;
}
