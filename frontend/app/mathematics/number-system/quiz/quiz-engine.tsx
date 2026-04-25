"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function QuizEngine() {
  return (
    <main className="quiz-coming-soon min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/80">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/mathematics/number-system"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Back to Number System topic"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-slate-500">Number System Quiz</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Coming soon</h1>
          </div>
        </div>

        <p className="mb-6 text-base leading-7 text-slate-600">
          The Number System quiz page has been added. Questions are being prepared and will be available shortly. For now, you can return to the topic page and explore other practice modes.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/mathematics/number-system"
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Back to topic
          </Link>
        </div>
      </div>
    </main>
  );
}
