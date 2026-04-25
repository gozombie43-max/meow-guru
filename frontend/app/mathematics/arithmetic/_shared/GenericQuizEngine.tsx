"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface GenericQuizEngineProps {
  topicTitle: string;
  topicRoute: string;
}

export default function GenericQuizEngine({ topicTitle, topicRoute }: GenericQuizEngineProps) {
  return (
    <main className="quiz-coming-soon min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={topicRoute}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label={`Back to ${topicTitle} topic`}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-slate-500">{topicTitle} Quiz</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Quiz route is ready</h1>
          </div>
        </div>

        <p className="mb-6 text-base leading-7 text-slate-600">
          The quiz page for <strong>{topicTitle}</strong> has been added. Use the Explore Features cards on the topic page to begin the quiz experience.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={topicRoute}
            className="rounded-2xl border border-slate-200 bg-slate-100 px-5 py-4 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Back to topic
          </Link>
          <Link
            href="/mathematics/arithmetic"
            className="rounded-2xl bg-slate-900 px-5 py-4 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Back to Arithmetic topics
          </Link>
        </div>
      </div>
    </main>
  );
}
