"use client";

import { useQuestions } from "@/hooks/useQuestions";
import {
  ArrowRight,
  FileText,
  Globe,
  Layers,
  Sparkles,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ConfigurationTemplate from "@/design-system/layouts/ConfigurationTemplate";

export interface StudyModeStartProps {
  title: string;
  slug: string;
  subtitle?: string;
  quizHref?: string;
  backHref?: string;
}

export default function StudyModeStartView({
  title,
  slug,
  subtitle = "Bilingual study deck with Bengali translations and usage definitions.",
  quizHref,
  backHref,
}: StudyModeStartProps) {
  const router = useRouter();
  const { questions, isLoading, isError } = useQuestions({
    subject: "english",
    topic: slug,
    questionType: "study-mode",
  });

  const targetQuizHref = quizHref ?? `/english/${slug}/study-mode/quiz`;
  const targetBackHref = backHref ?? `/english/${slug}`;

  // Keyboard shortcut: Press Enter to open suite immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.target === document.body) {
        router.replace(targetQuizHref);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, targetQuizHref]);

  const formattedCount = isLoading
    ? "…"
    : isError
      ? "—"
      : (questions?.length ?? 0).toLocaleString();

  return (
    <ConfigurationTemplate
      variant="setup"
      headerProps={{
        title: `${title} · Study Mode`,
        backHref: targetBackHref,
        backLabel: "Back to topic",
      }}
      hero={
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--meow-border)] bg-[var(--meow-surface)] p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--meow-accent)] text-white shadow-sm">
              <FileText size={24} strokeWidth={2.2} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--meow-accent-soft,#2563eb1a)] px-2.5 py-0.5 text-xs font-semibold text-[var(--meow-accent,#3b82f6)]">
                <Sparkles size={12} />
                Study deck ready
              </span>
              <h1 className="text-xl font-bold tracking-tight text-[var(--meow-text)] sm:text-2xl">
                {title}
              </h1>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-[var(--meow-text-muted,#94a3b8)]">
            {subtitle}
          </p>
        </div>
      }
      summary={
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--meow-border)] bg-[var(--meow-surface)] p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--meow-text-muted,#94a3b8)]">
            Deck Summary
          </h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-[var(--meow-border)] bg-[var(--meow-bg)] p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
                  <Layers size={16} strokeWidth={2.2} />
                </div>
                <span className="text-sm font-medium text-[var(--meow-text)]">
                  Total Entries
                </span>
              </div>
              <span className="text-sm font-bold text-[var(--meow-text)]">
                {formattedCount}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--meow-border)] bg-[var(--meow-bg)] p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                  <Globe size={16} strokeWidth={2.2} />
                </div>
                <span className="text-sm font-medium text-[var(--meow-text)]">
                  Languages
                </span>
              </div>
              <span className="text-sm font-semibold text-[var(--meow-text)]">
                EN · BN
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--meow-border)] bg-[var(--meow-bg)] p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                  <Volume2 size={16} strokeWidth={2.2} />
                </div>
                <span className="text-sm font-medium text-[var(--meow-text)]">
                  Audio Hook
                </span>
              </div>
              <span className="text-sm font-semibold text-[var(--meow-text)]">
                Available
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-[var(--meow-border)] p-3 text-xs text-[var(--meow-text-muted,#94a3b8)]">
            Tip: Press <kbd className="rounded border border-[var(--meow-border)] bg-[var(--meow-surface)] px-1.5 py-0.5 font-mono text-[11px] font-semibold">Enter</kbd> to launch immediately.
          </div>
        </div>
      }
      actionBar={
        <div className="flex w-full items-center justify-between gap-3">
          <Link
            href={targetBackHref}
            data-ui-button="secondary"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--meow-border)] px-4 py-2.5 text-sm font-semibold text-[var(--meow-text)] hover:bg-[var(--meow-surface)]"
          >
            Back
          </Link>
          <button
            type="button"
            data-ui-button="primary"
            onClick={() => router.replace(targetQuizHref)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--meow-action-fill,#2563eb)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 sm:flex-initial"
          >
            <span>Start Study Mode</span>
            <ArrowRight size={16} strokeWidth={2.4} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-[var(--meow-border)] bg-[var(--meow-surface)] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--meow-text)]">
            How This Study Deck Works
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-xl border border-[var(--meow-border)] bg-[var(--meow-bg)] p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--meow-accent,#3b82f6)]">
                Bilingual Clarity
              </span>
              <p className="text-xs leading-relaxed text-[var(--meow-text-muted,#94a3b8)]">
                Every term includes authentic English definitions side-by-side with Bengali translations for maximum retention.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-[var(--meow-border)] bg-[var(--meow-bg)] p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--meow-accent,#3b82f6)]">
                Interactive Palette
              </span>
              <p className="text-xs leading-relaxed text-[var(--meow-text-muted,#94a3b8)]">
                Browse alphabetically, search by keywords, and bookmark difficult entries to build your personalized revision queue.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-[var(--meow-border)] bg-[var(--meow-bg)] p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--meow-accent,#3b82f6)]">
                Audio Pronunciation
              </span>
              <p className="text-xs leading-relaxed text-[var(--meow-text-muted,#94a3b8)]">
                Click any speaker icon to listen to natural pronunciation and reinforce auditory recognition during test preparation.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-[var(--meow-border)] bg-[var(--meow-bg)] p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--meow-accent,#3b82f6)]">
                Safe Navigation
              </span>
              <p className="text-xs leading-relaxed text-[var(--meow-text-muted,#94a3b8)]">
                Your place and saved terms are safely preserved. You can pause and return to your study deck at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ConfigurationTemplate>
  );
}
