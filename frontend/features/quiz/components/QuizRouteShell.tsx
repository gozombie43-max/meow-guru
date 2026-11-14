"use client";

import { Suspense, type ReactNode } from "react";
import { Spinner } from "@/design-system/components/Spinner";

function QuizLoading() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{
        background: "var(--meow-bg, #000000)",
        color: "var(--meow-text-muted, #94A3B8)",
      }}
      role="status"
    >
      <Spinner size="lg" label="Loading quiz…" />
    </div>
  );
}

export default function QuizRouteShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={<QuizLoading />}>{children}</Suspense>;
}

