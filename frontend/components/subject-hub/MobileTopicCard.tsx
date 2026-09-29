"use client";
import Link from "next/link";
import React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import styles from "./mobile-topic-card.module.css";

// ── Inline SVG decorations (pure CSS/SVG, no images) ──────────────────────────
function BarsDecoration() {
  return (
    <svg viewBox="0 0 80 56" fill="currentColor" aria-hidden="true" className={styles.decoration}>
      <rect x="4" y="32" width="12" height="24" rx="3" opacity="0.7" />
      <rect x="20" y="20" width="12" height="36" rx="3" opacity="0.8" />
      <rect x="36" y="10" width="12" height="46" rx="3" />
      <rect x="52" y="4" width="12" height="52" rx="3" opacity="0.9" />
      <rect x="68" y="16" width="12" height="40" rx="3" opacity="0.75" />
    </svg>
  );
}

function PieDecoration() {
  return (
    <svg viewBox="0 0 72 72" fill="none" aria-hidden="true" className={styles.decoration}>
      <circle cx="36" cy="36" r="30" stroke="currentColor" strokeWidth="6" strokeDasharray="90 102" strokeDashoffset="0" />
      <circle cx="36" cy="36" r="30" stroke="currentColor" strokeWidth="6" strokeDasharray="50 142" strokeDashoffset="-90" opacity="0.55" />
      <circle cx="36" cy="36" r="30" stroke="currentColor" strokeWidth="6" strokeDasharray="40 152" strokeDashoffset="-140" opacity="0.35" />
      <line x1="36" y1="36" x2="36" y2="6" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="36" y1="36" x2="64" y2="47" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}

function CoinsDecoration() {
  return (
    <svg viewBox="0 0 72 80" fill="currentColor" aria-hidden="true" className={styles.decoration}>
      <ellipse cx="36" cy="68" rx="28" ry="7" opacity="0.9" />
      <ellipse cx="36" cy="60" rx="28" ry="7" opacity="0.75" />
      <ellipse cx="36" cy="52" rx="28" ry="7" opacity="0.6" />
      <ellipse cx="36" cy="44" rx="28" ry="7" opacity="0.5" />
      <ellipse cx="36" cy="36" rx="28" ry="7" opacity="0.35" />
    </svg>
  );
}

function PercentDecoration() {
  return (
    <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" aria-hidden="true" className={styles.decoration}>
      <text x="4" y="66" fontSize="72" fontWeight="700" fill="currentColor" stroke="none" opacity="0.9">%</text>
    </svg>
  );
}

function GearDecoration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className={styles.decoration}>
      <circle cx="36" cy="36" r="14" />
      <circle cx="36" cy="36" r="6" />
      {[0,45,90,135,180,225,270,315].map((a,i)=>{
        const r=Math.PI*a/180;
        const x1=36+18*Math.cos(r),y1=36+18*Math.sin(r);
        const x2=36+26*Math.cos(r),y2=36+26*Math.sin(r);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round"/>;
      })}
      <circle cx="60" cy="58" r="8" opacity="0.5" />
      <circle cx="60" cy="58" r="3" opacity="0.5" />
    </svg>
  );
}

function SpeedometerDecoration() {
  return (
    <svg viewBox="0 0 80 56" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className={styles.decoration}>
      <path d="M8 52 A32 32 0 0 1 72 52" strokeLinecap="round" />
      <path d="M16 52 A24 24 0 0 1 64 52" strokeLinecap="round" opacity="0.55" />
      <line x1="40" y1="52" x2="22" y2="24" strokeLinecap="round" strokeWidth="2.5" />
      <circle cx="40" cy="52" r="4" fill="currentColor" stroke="none" />
      {[0,30,60,90,120,150,180].map((a,i)=>{
        const r=Math.PI*(180-a)/180;
        const x1=40+28*Math.cos(r),y1=52-28*Math.sin(r);
        const x2=40+32*Math.cos(r),y2=52-32*Math.sin(r);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.5" opacity={i===3?1:0.4}/>;
      })}
    </svg>
  );
}

function GraphDecoration() {
  return (
    <svg viewBox="0 0 80 64" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={styles.decoration}>
      <path d="M6 58 Q20 10 40 28 Q56 44 74 6" strokeLinecap="round" />
      <path d="M6 58 Q20 20 40 36 Q56 50 74 18" strokeLinecap="round" opacity="0.45" />
      <line x1="6" y1="6" x2="6" y2="58" strokeWidth="1.5" opacity="0.4" />
      <line x1="6" y1="58" x2="74" y2="58" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

const DECORATIONS: Record<string, React.FC> = {
  bars: BarsDecoration,
  pie: PieDecoration,
  coins: CoinsDecoration,
  percent: PercentDecoration,
  gears: GearDecoration,
  speed: SpeedometerDecoration,
  graph: GraphDecoration,
};

// Map topic slug → decoration key
const SLUG_TO_DECORATION: Record<string, string> = {
  percentages: "bars",
  "ratio-and-proportion": "pie",
  "profit-and-loss": "bars",
  "simple-interest": "coins",
  "compound-interest": "percent",
  "time-and-work": "gears",
  "time-and-distance": "speed",
  algebra: "graph",
  geometry: "graph",
  mensuration: "pie",
  trigonometry: "graph",
  "number-system": "bars",
  averages: "bars",
  discount: "coins",
  "mixture-and-alligation": "pie",
  partnership: "coins",
  "square-roots": "graph",
  "statistics-probability": "pie",
};

export interface MobileTopicCardProps {
  href: string;
  slug: string;
  name: string;
  icon: LucideIcon;
  accent: string;
  questionCount?: number;
}

export const MobileTopicCard = React.memo(function MobileTopicCard({
  href,
  slug,
  name,
  icon: Icon,
  accent,
  questionCount,
}: MobileTopicCardProps) {
  const decorKey = SLUG_TO_DECORATION[slug] ?? "bars";
  const DecorationComp = DECORATIONS[decorKey];

  return (
    <Link
      href={href}
      prefetch={false}
      className={styles.card}
      style={{ "--accent": accent } as React.CSSProperties}
      aria-label={`${name}${questionCount !== undefined ? `, ${questionCount} questions` : ""}`}
    >
      {/* Inner highlight pseudo-element is CSS-only */}
      <div className={styles.cardInner}>
        {/* Icon tile + meta */}
        <div className={styles.cardTop}>
          <div className={styles.iconTile} aria-hidden="true">
            <Icon size={22} strokeWidth={2} color="#fff" />
          </div>
          {/* Chevron */}
          <div className={styles.chevron} aria-hidden="true">
            <ChevronRight size={13} strokeWidth={2.5} />
          </div>
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.topicTitle}>{name}</span>
          <span className={styles.topicCount}>
            {questionCount !== undefined ? `${questionCount} Questions` : "—"}
          </span>
        </div>

        {/* Decorative SVG */}
        <div className={styles.decorWrap} aria-hidden="true" style={{ color: accent }}>
          <DecorationComp />
        </div>
      </div>
    </Link>
  );
});
