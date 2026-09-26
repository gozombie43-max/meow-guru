"use client";

import React, { lazy, Suspense } from "react";
import { containsMathSyntax } from "./math-syntax";

export { containsMathSyntax } from "./math-syntax";

const MathRendererContent = lazy(() => import("./MathRendererContent"));

interface MathRendererProps {
  text: string;
  className?: string;
  inline?: boolean;
}

const MathRenderer = React.memo(function MathRenderer(props: MathRendererProps) {
  const { text, className = "" } = props;
  if (!text) return null;
  const plainText = (
    <span className={`math-text inline leading-relaxed ${className}`} style={{ wordBreak: "break-word" }}>
      {text}
    </span>
  );
  // Text-only questions should never download or execute the math typesetter.
  if (!containsMathSyntax(text) && !text.includes("/")) return plainText;
  return <Suspense fallback={plainText}><MathRendererContent {...props} /></Suspense>;
});

export default MathRenderer;
