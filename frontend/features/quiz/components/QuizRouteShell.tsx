import { Suspense, type ReactNode } from "react";

function QuizLoading() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{
        background: "var(--background, var(--oled-canvas, #000000))",
        color: "var(--text-secondary, var(--oled-secondary, #a2a9b4))",
      }}
      role="status"
    >
      <div className="animate-pulse text-base font-medium">Loading quiz…</div>
    </div>
  );
}

export default function QuizRouteShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={<QuizLoading />}>{children}</Suspense>;
}
