"use client";
import { ThemeToggle } from "@/components/quiz-engine/ui/SharedUI";
import {
  DEFAULT_CONCEPT_COLOUR,
  MathFraction,
} from "@/components/quiz-engine/utils";
import { Flame, RotateCcw, Target } from "lucide-react";
import Link from "next/link";
import type { QuizController } from "../hooks/useQuizController";
export function ResultView({
  subjectConfig,
  theme,
  themeStyles,
  modeLabels,
  mode,
  stats,
  bestStreak,
  results,
  questions,
  conceptOptions,
  conceptColours,
  weakConcepts,
  handleRestart,
  routeBase,
  slug,
}: Pick<
  QuizController,
  | "subjectConfig"
  | "theme"
  | "themeStyles"
  | "modeLabels"
  | "mode"
  | "stats"
  | "bestStreak"
  | "results"
  | "questions"
  | "conceptOptions"
  | "conceptColours"
  | "weakConcepts"
  | "handleRestart"
  | "routeBase"
  | "slug"
>) {
  return (
    <div
      className={`${subjectConfig.cssClassName} min-h-dvh relative overflow-hidden`}
      data-theme={theme}
      style={{ background: "var(--quiz-bg)", color: "var(--quiz-text)" }}
    >
      {themeStyles}
      <div className="pt-28 pb-20 px-6 max-w-3xl mx-auto relative">
        <div className="mb-6 flex justify-end">
          <ThemeToggle />
        </div>
        <h1
          className="animate-fade-in-up text-3xl font-bold mb-2 text-[var(--text-primary)]"
          style={{
            fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif",
          }}
        >
          Session{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Complete
          </span>
        </h1>
        <p
          className="animate-fade-in-up text-[color:var(--quiz-text-muted)] mb-10"
          style={{ animationDelay: "100ms" }}
        >
          Here is how you performed in this {modeLabels[mode]} session.
        </p>

        <div
          className="animate-fade-in-up grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10"
          style={{ animationDelay: "200ms" }}
        >
          {[
            {
              label: "Correct",
              value: stats.correct,
              color: "text-emerald-600",
            },
            { label: "Wrong", value: stats.wrong, color: "text-red-500" },
            {
              label: "Accuracy",
              value: `${stats.accuracy}%`,
              color: "text-violet-600",
            },
            {
              label: "Avg Time",
              value: `${stats.avgTime}s`,
              color: "text-amber-600",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="glass-card rounded-xl p-5 text-center"
            >
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[color:var(--quiz-text-soft)] mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div
          className="animate-fade-in-up grid grid-cols-2 gap-4 mb-10"
          style={{ animationDelay: "250ms" }}
        >
          <div className="glass-card rounded-xl p-5">
            <div className="text-sm text-[color:var(--quiz-text-soft)] mb-1">
              Best Streak
            </div>
            <div className="text-xl font-bold text-violet-600 flex items-center gap-2">
              <Flame className="w-5 h-5" /> {bestStreak}
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="text-sm text-[color:var(--quiz-text-soft)] mb-1">
              Questions Done
            </div>
            <div className="text-xl font-bold text-[var(--text-primary)] flex items-center justify-center gap-2">
              <MathFraction
                numerator={results.length}
                denominator={questions.length}
              />
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div
            className="animate-fade-in-up glass-card rounded-xl p-6 mb-6"
            style={{ animationDelay: "300ms" }}
          >
            <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#7c3aed",
                }}
              />
              Concept Breakdown
            </h3>
            <div className="space-y-3">
              {conceptOptions.map((concept) => {
                const conceptResults = results.filter(
                  (r) => r.concept === concept,
                );
                if (conceptResults.length === 0) return null;
                const correct = conceptResults.filter(
                  (r) => r.isCorrect,
                ).length;
                const pct = Math.round((correct / conceptResults.length) * 100);
                const col = conceptColours[concept] ?? DEFAULT_CONCEPT_COLOUR;
                return (
                  <div key={concept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[color:var(--quiz-text-muted)]">
                        {concept}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: col.bg,
                          color: col.text,
                          border: `1px solid ${col.border}`,
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--quiz-surface-muted)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background:
                            pct >= 70
                              ? "#059669"
                              : pct >= 40
                                ? "#D97706"
                                : "#DC2626",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {weakConcepts.length > 0 && (
          <div
            className="animate-fade-in-up glass-card rounded-xl p-6 mb-10"
            style={{ animationDelay: "350ms" }}
          >
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
              <Target className="w-4 h-4 text-red-500" />
              Weak Areas - Needs Practice
            </h3>
            <div className="space-y-3">
              {weakConcepts.map((wc) => (
                <div
                  key={wc.concept}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-[color:var(--quiz-text-muted)]">
                    {wc.concept}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/25">
                    {wc.accuracy}% accuracy
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className="animate-fade-in-up flex flex-col sm:flex-row gap-4"
          style={{ animationDelay: "450ms" }}
        >
          <button
            onClick={handleRestart}
            className="btn-glow px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
              color: "#fff",
              border: "none",
            }}
          >
            <RotateCcw className="w-4 h-4" /> Practice Again
          </button>
          <Link
            href={routeBase ?? `/${subjectConfig.subjectId}/${slug}`}
            className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
          >
            Change Mode
          </Link>
          <Link
            href={`/${subjectConfig.subjectId}`}
            className="btn-outline px-6 py-3 rounded-xl font-medium text-center cursor-pointer"
          >
            All Topics
          </Link>
        </div>
      </div>
    </div>
  );
}
