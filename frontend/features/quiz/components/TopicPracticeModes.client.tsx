"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { useQuestionCounts } from "@/hooks/useQuestionCounts";

export default function TopicPracticeModes({
  subject,
  questionTopic,
  base,
  formulaSubtitle,
  mixedSubtitle,
  hasStudyMode,
}: {
  subject: "mathematics" | "reasoning" | "english" | "general-awareness" | "iit-jam-physics";
  questionTopic: string;
  base: string;
  formulaSubtitle: string;
  mixedSubtitle: string;
  hasStudyMode: boolean;
}) {
  const { counts, isPending, isError } = useQuestionCounts({ topic: questionTopic, subject });
  // Animate counts in only if the user actually saw the skeleton; cached
  // counts render instantly without motion.
  const [revealWithMotion] = useState(isPending);

  const modes = [
    { title: "PYQ", sub: "Previous year Qs", href: `${base}/quiz?mode=concept`, mode: "concept", icon: "/icons/practice/pyq.svg" },
    { title: "CareerWill", sub: formulaSubtitle, href: `${base}/quiz?mode=formula`, mode: "formula", icon: "/icons/practice/careerwill.svg" },
    { title: "PW", sub: mixedSubtitle, href: `${base}/quiz?mode=mixed`, mode: "mixed", icon: "/icons/practice/pw.svg" },
    { title: "Selection Way", sub: "Speed test", href: `${base}/quiz?mode=ai-challenge`, mode: "ai-challenge", icon: "/icons/practice/selection-way.svg" },
    { title: "Topic Mix", sub: "Foundation easy", href: `${base}/quiz?mode=easy`, mode: "easy", icon: "/icons/practice/topic-mix.svg" },
    { title: "Tier 2", sub: "Advanced level", href: `${base}/quiz?mode=hard`, mode: "hard", icon: "/icons/practice/tier-2.svg" },
    ...(hasStudyMode ? [{ title: "Study Mode", sub: "Interactive study deck", href: `${base}/study-mode`, mode: "study-mode", icon: "/icons/practice/study-mode.svg" }] : []),
  ];

  const jamLabels: Record<string, string> = { formula: 'Formula practice', mixed: 'Mixed practice', 'ai-challenge': 'Speed practice', hard: 'Advanced practice' };
  if (subject === 'iit-jam-physics') modes.forEach(item => { if (jamLabels[item.mode]) item.title = jamLabels[item.mode]; });
  return (
    <div className="sg-grid" data-reveal={revealWithMotion ? "motion" : undefined}>
      {modes.map((mode) => {
        const countLabel = isError ? "—" : `${counts[mode.mode] ?? 0}`;
        const isEmpty = !isPending && !isError && countLabel === "0";
        const cardContent = (
          <>
            <div className="sg-card-left">
              <div className="sg-badge"><Image src={mode.icon} alt="" width={28} height={28} aria-hidden="true" /></div>
              <div className="sg-card-info">
                <div className="sg-card-name">{mode.title}</div>
                <div className="sg-card-sub">{mode.sub}</div>
              </div>
            </div>
            <div className="sg-card-tab" aria-hidden="true">
              <svg className="sg-tab-bg-svg" viewBox="0 0 88 46" preserveAspectRatio="none">
                <path d="M28 0 C28 10, 0 13, 0 23 C0 33, 28 36, 28 46 L88 46 L88 0 Z" fill="var(--meow-surface-subtle)" />
              </svg>
              <div className="sg-tab-action-wrap">
                {isPending ? (
                  <span className="sg-card-qs-skeleton" role="status" aria-label="Loading question count" />
                ) : isEmpty ? (
                  <span className="sg-card-qs-text" data-zero="true">Soon</span>
                ) : (
                  <span
                    className="sg-card-qs-text"
                    data-zero={countLabel === "—" ? "true" : undefined}
                  >
                    <span>{countLabel}</span>
                    <span className="sg-card-qs-label">Qs</span>
                  </span>
                )}
              </div>
            </div>
          </>
        );
        if (isEmpty) {
          return (
            <div
              key={mode.title}
              className="sg-card"
              data-empty="true"
              aria-disabled="true"
            >
              {cardContent}
            </div>
          );
        }
        return (
          <Link
            key={mode.title}
            href={mode.href}
            // Keep the separated mathematics quiz bundle off the topic page
            // until a mode is selected, especially on mobile connections.
            prefetch={subject === "mathematics" ? false : undefined}
            className="sg-card"
          >
            {cardContent}
          </Link>
        );
      })}
    </div>
  );
}
