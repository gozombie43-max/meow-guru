import React from "react";
import "katex/dist/katex.min.css";
import { BlockMath, InlineMath } from "react-katex";

interface MathRendererProps {
  text: string;
  block?: boolean;
  className?: string;
}

// Detects if the string contains LaTeX math delimiters
function isLatex(text: string) {
  return /\\\(|\\\)|\\\[|\\\]|\$/.test(text);
}

export default function MathRenderer({ text, block = false, className = "" }: MathRendererProps) {
  if (isLatex(text)) {
    // If the text contains LaTeX delimiters, render as math
    return block ? (
      <BlockMath math={text} className={className} />
    ) : (
      <InlineMath math={text} className={className} />
    );
  }
  // Otherwise, render as plain text
  return <span className={className}>{text}</span>;
}
