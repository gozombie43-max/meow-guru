import { hasSlashOutsideUrls } from './content-urls';
import React from "react";
import MathRenderer from "@/components/MathRenderer";
import { containsMathSyntax } from "@/components/math-syntax";

type Props = { text: string; className?: string };

const MathText = React.memo(function MathText({ text, className = "" }: Props) {
  if (!text) return <span className={className} />;

  // Keep prose, alternatives, URLs, and dates synchronous. Real math and
  // standalone numeric fractions use MathRenderer so both components share
  // KaTeX's stable inline layout instead of a separate stacked-span layout.
  if (!containsMathSyntax(text) && !hasSlashOutsideUrls(text)) {
    return <span className={className}>{text}</span>;
  }
  return <MathRenderer text={text} className={className} />;
});

export default MathText;
