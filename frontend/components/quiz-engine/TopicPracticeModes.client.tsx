"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  BookOpenCheck,
  Compass,
  FileQuestion,
  Flame,
  Shuffle,
  Sparkles,
  Zap,
} from "lucide-react";
import { useQuestionCounts } from "@/hooks/useQuestionCounts";

export default function TopicPracticeModes({
  subject,
  questionTopic,
  base,
  formulaSubtitle,
  mixedSubtitle,
  hasStudyMode,
}: {
  subject: "mathematics" | "reasoning" | "english" | "general-awareness";
  questionTopic: string;
  base: string;
  formulaSubtitle: string;
  mixedSubtitle: string;
  hasStudyMode: boolean;
}) {
  const { counts, isLoading, isError } = useQuestionCounts({ topic: questionTopic, subject });
  const modes = [
    {
      title: "PYQ", sub: "Previous year Qs", href: `${base}/quiz?mode=concept`, mode: "concept",
      icon: FileQuestion, color: "#0d9488", gradient: "linear-gradient(135deg, #e6f7f2 0%, #d4f3eb 100%)",
      gradientDark: "linear-gradient(135deg, rgba(13, 148, 136, 0.2) 0%, rgba(13, 148, 136, 0.08) 100%)",
      border: "rgba(13, 148, 136, 0.22)", borderDark: "rgba(13, 148, 136, 0.35)", shadow: "0 2px 8px rgba(13, 148, 136, 0.08)",
    },
    {
      title: "CareerWill", sub: formulaSubtitle, href: `${base}/quiz?mode=formula`, mode: "formula",
      icon: BookOpenCheck, color: "#2563eb", gradient: "linear-gradient(135deg, #edf4fe 0%, #dbeafe 100%)",
      gradientDark: "linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(37, 99, 235, 0.08) 100%)",
      border: "rgba(37, 99, 235, 0.22)", borderDark: "rgba(37, 99, 235, 0.35)", shadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
    },
    {
      title: "PW", sub: mixedSubtitle, href: `${base}/quiz?mode=mixed`, mode: "mixed",
      icon: Shuffle, color: "#4f46e5", gradient: "linear-gradient(135deg, #f1f3fd 0%, #e0e7ff 100%)",
      gradientDark: "linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(79, 70, 229, 0.08) 100%)",
      border: "rgba(79, 70, 229, 0.22)", borderDark: "rgba(79, 70, 229, 0.35)", shadow: "0 2px 8px rgba(79, 70, 229, 0.08)",
    },
    {
      title: "Selection Way", sub: "Speed test", href: `${base}/quiz?mode=ai-challenge`, mode: "ai-challenge",
      icon: Zap, color: "#7c3aed", gradient: "linear-gradient(135deg, #f7f2fe 0%, #ede9fe 100%)",
      gradientDark: "linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0.08) 100%)",
      border: "rgba(124, 58, 237, 0.22)", borderDark: "rgba(124, 58, 237, 0.35)", shadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
    },
    {
      title: "Topic Mix", sub: "Foundation easy", href: `${base}/quiz?mode=easy`, mode: "easy",
      icon: Compass, color: "#0284c7", gradient: "linear-gradient(135deg, #edf9ff 0%, #e0f2fe 100%)",
      gradientDark: "linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(2, 132, 199, 0.08) 100%)",
      border: "rgba(2, 132, 199, 0.22)", borderDark: "rgba(2, 132, 199, 0.35)", shadow: "0 2px 8px rgba(2, 132, 199, 0.08)",
    },
    {
      title: "Tier 2", sub: "Advanced level", href: `${base}/quiz?mode=hard`, mode: "hard",
      icon: Flame, color: "#e11d48", gradient: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
      gradientDark: "linear-gradient(135deg, rgba(225, 29, 72, 0.2) 0%, rgba(225, 29, 72, 0.08) 100%)",
      border: "rgba(225, 29, 72, 0.22)", borderDark: "rgba(225, 29, 72, 0.35)", shadow: "0 2px 8px rgba(225, 29, 72, 0.08)",
    },
    ...(hasStudyMode ? [{
      title: "Study Mode", sub: "Interactive study deck", href: `${base}/study-mode`, mode: "study-mode",
      icon: Sparkles, color: "#ec4899", gradient: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
      gradientDark: "linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(236, 72, 153, 0.08) 100%)",
      border: "rgba(236, 72, 153, 0.22)", borderDark: "rgba(236, 72, 153, 0.35)", shadow: "0 2px 8px rgba(236, 72, 153, 0.08)",
    }] : []),
  ];

  return (
    <div className="sg-grid">
      {modes.map((mode) => {
        const ModeIcon = mode.icon;
        const countLabel = isLoading ? "… Qs" : isError ? "— Qs" : `${counts[mode.mode] ?? 0} Qs`;
        return (
          <Link
            key={mode.title}
            href={mode.href}
            className="sg-card"
            style={{
              "--card-gradient": mode.gradient,
              "--card-gradient-dark": mode.gradientDark,
              "--card-border": mode.border,
              "--card-border-dark": mode.borderDark,
              "--card-accent": mode.color,
              "--card-shadow": mode.shadow,
            } as CSSProperties}
          >
            <div className="sg-card-left">
              <div className="sg-badge"><ModeIcon size={18} strokeWidth={2.2} /></div>
              <div className="sg-card-info">
                <div className="sg-card-name">{mode.title}</div>
                <div className="sg-card-sub">{mode.sub}</div>
              </div>
            </div>
            <div className="sg-card-tab" aria-hidden="true">
              <svg className="sg-tab-bg-svg" viewBox="0 0 88 46" preserveAspectRatio="none">
                <path d="M28 0 C28 10, 0 13, 0 23 C0 33, 28 36, 28 46 L88 46 L88 0 Z" fill="#ffffff" />
              </svg>
              <div className="sg-tab-action-wrap">
                <span className="sg-card-qs-text">{countLabel}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
