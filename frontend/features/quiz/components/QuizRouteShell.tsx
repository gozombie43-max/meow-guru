import { Suspense, type ReactNode } from "react";

function QuizLoading() {
  return (
    <div className="min-h-dvh flex items-center justify-center" role="status">
      <div className="animate-pulse text-slate-500 text-lg">Loading quiz…</div>
    </div>
  );
}

export default function QuizRouteShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={<QuizLoading />}>{children}</Suspense>;
}
