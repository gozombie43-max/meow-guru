"use client";
import Link from "next/link";
import React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import styles from "./mobile-topic-card.module.css";

// Iconify icon names per slug — uses <iconify-icon> web component via CDN
const SLUG_ICON: Record<string, string> = {
  percentages: "ph:percent-bold",
  "ratio-and-proportion": "tabler:divide",
  "profit-and-loss": "ph:trend-up-bold",
  "simple-interest": "ph:bank-bold",
  "compound-interest": "ph:coins-bold",
  "time-and-work": "ph:clock-countdown-bold",
  "time-and-distance": "tabler:gauge",
  algebra: "ph:function-bold",
  geometry: "tabler:compass",
  mensuration: "tabler:cube",
  trigonometry: "ph:wave-sine-bold",
  "number-system": "tabler:123",
  averages: "ph:chart-bar-horizontal-bold",
  discount: "ph:tag-chevron-bold",
  "mixture-and-alligation": "ph:flask-bold",
  partnership: "ph:handshake-bold",
  "square-roots": "ph:radical-bold",
  "statistics-probability": "ph:chart-pie-slice-bold",
};

// ── Premium SVG Decorations ──────────────────────────────────────────────────

function BarsDecoration() {
  const bars = [
    { x: 4,  h: 38, op: 0.35 },
    { x: 18, h: 52, op: 0.5  },
    { x: 32, h: 28, op: 0.65 },
    { x: 46, h: 58, op: 0.8  },
    { x: 60, h: 42, op: 0.65 },
    { x: 74, h: 20, op: 0.45 },
  ];
  return (
    <svg viewBox="0 0 96 64" fill="currentColor" aria-hidden="true" className={styles.decoration}>
      {/* Grid lines */}
      {[16, 32, 48].map(y => (
        <line key={y} x1="0" y1={y} x2="96" y2={y} stroke="currentColor" strokeWidth="0.5" opacity="0.18" />
      ))}
      {/* Bars */}
      {bars.map(({ x, h, op }) => (
        <rect key={x} x={x} y={64 - h} width="10" height={h} rx="3" opacity={op} />
      ))}
      {/* Top cap on tallest bar */}
      <rect x="46" y="4" width="10" height="3" rx="1.5" opacity="0.95" />
    </svg>
  );
}

function CurveDecoration() {
  return (
    <svg viewBox="0 0 96 56" fill="none" aria-hidden="true" className={styles.decoration}>
      <path
        d="M0 56 L0 36 C18 36 22 8 40 16 C58 24 70 6 96 12 L96 56 Z"
        fill="currentColor" opacity="0.18"
      />
      <path
        d="M0 36 C18 36 22 8 40 16 C58 24 70 6 96 12"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      />
      <circle cx="70" cy="6" r="3.5" fill="currentColor" />
      <circle cx="40" cy="16" r="2.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function PieDecoration() {
  const C = 201; // circumference 2π×32
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className={styles.decoration}>
      <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="12" strokeDasharray={`${C * 0.42} ${C * 0.58}`} strokeDashoffset="0" />
      <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="12" strokeDasharray={`${C * 0.3} ${C * 0.7}`} strokeDashoffset={`${-C * 0.42}`} opacity="0.55" />
      <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="12" strokeDasharray={`${C * 0.22} ${C * 0.78}`} strokeDashoffset={`${-C * 0.72}`} opacity="0.3" />
      <line x1="40" y1="40" x2="40" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="40" y1="40" x2="64" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

function CoinsDecoration() {
  const coins = [
    { y: 62, op: 1.0  },
    { y: 52, op: 0.82 },
    { y: 42, op: 0.62 },
    { y: 32, op: 0.42 },
    { y: 22, op: 0.26 },
  ];
  return (
    <svg viewBox="0 0 80 76" fill="currentColor" aria-hidden="true" className={styles.decoration}>
      {coins.map(({ y, op }) => (
        <g key={y} opacity={op}>
          <ellipse cx="40" cy={y} rx="30" ry="9" />
          {/* side depth band */}
          {y < 62 && <rect x="10" y={y} width="60" height="10" opacity="0.5" />}
        </g>
      ))}
    </svg>
  );
}

function PercentDecoration() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className={styles.decoration}>
      <text x="2" y="74" fontSize="78" fontWeight="800" fill="currentColor" opacity="0.85">%</text>
      <circle cx="18" cy="18" r="7" fill="currentColor" opacity="0.6" />
      <circle cx="62" cy="62" r="5" fill="currentColor" opacity="0.4" />
      <line x1="22" y1="58" x2="58" y2="20" stroke="currentColor" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

function GearDecoration() {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  const smallTeeth = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={styles.decoration}>
      {/* Main gear body */}
      <circle cx="34" cy="34" r="15" />
      {/* Inner hole */}
      <circle cx="34" cy="34" r="6" />
      {/* 8 teeth as spokes */}
      {teeth.map(deg => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 34 + 15 * Math.cos(rad);
        const y1 = 34 + 15 * Math.sin(rad);
        const x2 = 34 + 23 * Math.cos(rad);
        const y2 = 34 + 23 * Math.sin(rad);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="5" strokeLinecap="round" />;
      })}
      {/* Small gear */}
      <circle cx="60" cy="60" r="9" opacity="0.55" />
      <circle cx="60" cy="60" r="3.5" opacity="0.55" />
      {smallTeeth.map(deg => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={60 + 9 * Math.cos(rad)}
            y1={60 + 9 * Math.sin(rad)}
            x2={60 + 14 * Math.cos(rad)}
            y2={60 + 14 * Math.sin(rad)}
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        );
      })}
      <line x1="46" y1="44" x2="52" y2="52" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

function SpeedometerDecoration() {
  const ticks = [210, 240, 270, 300, 330];
  return (
    <svg viewBox="0 0 96 64" fill="none" stroke="currentColor" aria-hidden="true" className={styles.decoration}>
      {/* Outer arc */}
      <path d="M 14 58 A 34 34 0 1 1 82 58" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
      {/* Zone arc (inner) */}
      <path d="M 20 55 A 28 28 0 1 1 76 55" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      {/* Tick marks */}
      {ticks.map(deg => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const cx = 48, cy = 56;
        return (
          <line
            key={deg}
            x1={cx + 25 * Math.cos(rad)}
            y1={cy + 25 * Math.sin(rad)}
            x2={cx + 32 * Math.cos(rad)}
            y2={cy + 32 * Math.sin(rad)}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
          />
        );
      })}
      {/* Needle */}
      <line x1="48" y1="56" x2="28" y2="24" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="56" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WaveDecoration() {
  return (
    <svg viewBox="0 0 96 56" fill="none" stroke="currentColor" aria-hidden="true" className={styles.decoration}>
      {/* X-axis */}
      <line x1="0" y1="28" x2="96" y2="28" strokeWidth="0.8" opacity="0.22" />
      {/* Sine wave */}
      <path
        d="M0 28 C12 28 12 6 24 6 C36 6 36 50 48 50 C60 50 60 6 72 6 C84 6 84 50 96 50"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Cosine wave */}
      <path
        d="M0 8 C8 8 16 50 24 50 C32 50 40 6 48 6 C56 6 64 50 72 50 C80 50 88 6 96 6"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* Peak dots */}
      <circle cx="24" cy="6" r="3" fill="currentColor" stroke="none" />
      <circle cx="72" cy="6" r="3" fill="currentColor" stroke="none" opacity="0.5" />
    </svg>
  );
}

function NumberDecoration() {
  return (
    <svg viewBox="0 0 80 64" aria-hidden="true" className={styles.decoration}>
      <text x="8" y="58" fontSize="52" fontWeight="900" fill="currentColor" opacity="0.7" letterSpacing="-4">∞</text>
      <text x="4" y="16" fontSize="9" fontWeight="600" fill="currentColor" opacity="0.5" letterSpacing="1">10110</text>
      <text x="42" y="26" fontSize="8" fontWeight="600" fill="currentColor" opacity="0.35" letterSpacing="1">01001</text>
    </svg>
  );
}

function AlgebraDecoration() {
  return (
    <svg viewBox="0 0 80 64" fill="none" stroke="currentColor" aria-hidden="true" className={styles.decoration}>
      {/* Axes */}
      <line x1="8" y1="56" x2="78" y2="56" strokeWidth="1.2" opacity="0.3" />
      <line x1="12" y1="60" x2="12" y2="4" strokeWidth="1.2" opacity="0.3" />
      {/* Arrowheads */}
      <path d="M76 53 L79 56 L76 59" strokeWidth="1" opacity="0.3" />
      <path d="M9 6 L12 3 L15 6" strokeWidth="1" opacity="0.3" />
      {/* Parabola */}
      <path d="M 18 54 Q 44 4 72 30" strokeWidth="2.5" strokeLinecap="round" />
      {/* Second curve */}
      <path d="M 14 10 Q 44 58 72 50" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* x² label */}
      <text x="52" y="20" fontSize="11" fontWeight="700" fill="currentColor" stroke="none" opacity="0.7">x²</text>
    </svg>
  );
}

function CompassDecoration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={styles.decoration}>
      <circle cx="40" cy="40" r="30" opacity="0.6" />
      <circle cx="40" cy="40" r="20" opacity="0.35" />
      <line x1="40" y1="10" x2="40" y2="70" opacity="0.3" />
      <line x1="10" y1="40" x2="70" y2="40" opacity="0.3" />
      {/* Compass needle */}
      <path d="M40 40 L50 22" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 40 L30 58" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <circle cx="40" cy="40" r="4" fill="currentColor" stroke="none" opacity="0.8" />
    </svg>
  );
}

function CubeDecoration() {
  return (
    <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={styles.decoration}>
      {/* Front face */}
      <rect x="16" y="28" width="32" height="32" rx="2" />
      {/* Top face */}
      <path d="M16 28 L32 16 L64 16 L48 28 Z" />
      {/* Right face */}
      <path d="M48 28 L64 16 L64 48 L48 60 Z" />
      {/* Depth lines */}
      <line x1="16" y1="28" x2="48" y2="28" opacity="0.4" />
      <line x1="48" y1="28" x2="48" y2="60" opacity="0.4" />
    </svg>
  );
}

function FlaskDecoration() {
  return (
    <svg viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={styles.decoration}>
      <path d="M24 8 L24 32 L8 64 Q6 72 16 72 L48 72 Q58 72 56 64 L40 32 L40 8 Z" />
      <line x1="20" y1="8" x2="44" y2="8" strokeWidth="3" strokeLinecap="round" />
      {/* Liquid */}
      <path
        d="M12 56 Q18 50 32 54 Q46 58 52 56 L56 64 Q58 72 48 72 L16 72 Q6 72 8 64 Z"
        fill="currentColor"
        stroke="none"
        opacity="0.3"
      />
      {/* Bubbles */}
      <circle cx="28" cy="46" r="3" fill="currentColor" stroke="none" opacity="0.4" />
      <circle cx="38" cy="40" r="2" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  );
}

function HandshakeDecoration() {
  return (
    <svg viewBox="0 0 80 56" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={styles.decoration}>
      <path d="M4 32 C10 24 18 22 28 26 L40 32 L52 26 C62 22 70 24 76 32" strokeLinecap="round" />
      <path d="M28 26 L36 20 L44 24 L52 26" strokeLinecap="round" opacity="0.6" />
      {/* Clasped hands simplified */}
      <ellipse cx="40" cy="32" rx="12" ry="8" opacity="0.4" />
      <line x1="34" y1="36" x2="46" y2="36" opacity="0.3" />
    </svg>
  );
}

function TagDecoration() {
  return (
    <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={styles.decoration}>
      {/* Price tag */}
      <path d="M8 8 L8 38 L34 64 Q38 68 42 64 L64 42 Q68 38 64 34 L38 8 Z" />
      <circle cx="26" cy="24" r="5" />
      {/* Down arrow = discount */}
      <path d="M48 20 L56 32 L44 32 Z" fill="currentColor" stroke="none" opacity="0.5" />
      <text x="18" y="50" fontSize="14" fontWeight="800" fill="currentColor" stroke="none" opacity="0.6">%</text>
    </svg>
  );
}

function SurdDecoration() {
  return (
    <svg viewBox="0 0 80 64" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={styles.decoration}>
      {/* √ symbol */}
      <path d="M4 38 L18 54 L34 10 L76 10" strokeLinecap="round" strokeLinejoin="round" />
      {/* Subscript 2 */}
      <text x="8" y="52" fontSize="12" fontWeight="700" fill="currentColor" stroke="none" opacity="0.5">2</text>
      {/* Floating variable */}
      <text x="48" y="36" fontSize="22" fontWeight="700" fill="currentColor" stroke="none" opacity="0.35">x</text>
    </svg>
  );
}

// ── Decoration lookup ────────────────────────────────────────────────────────

const SLUG_DECORATION: Record<string, React.FC> = {
  percentages: PercentDecoration,
  "ratio-and-proportion": PieDecoration,
  "profit-and-loss": CurveDecoration,
  "simple-interest": CoinsDecoration,
  "compound-interest": CoinsDecoration,
  "time-and-work": GearDecoration,
  "time-and-distance": SpeedometerDecoration,
  algebra: AlgebraDecoration,
  geometry: CompassDecoration,
  mensuration: CubeDecoration,
  trigonometry: WaveDecoration,
  "number-system": NumberDecoration,
  averages: BarsDecoration,
  discount: TagDecoration,
  "mixture-and-alligation": FlaskDecoration,
  partnership: HandshakeDecoration,
  "square-roots": SurdDecoration,
  "statistics-probability": PieDecoration,
};

// ── Component ────────────────────────────────────────────────────────────────

export interface MobileTopicCardProps {
  href: string;
  slug: string;
  name: string;
  /** Kept for type compatibility — not rendered; Iconify is used instead */
  icon: LucideIcon;
  accent: string;
  detail?: { color?: string; questionCount?: number };
}

export const MobileTopicCard = React.memo(function MobileTopicCard({
  href,
  slug,
  name,
  accent,
  detail,
}: MobileTopicCardProps) {
  const DecorationComp = SLUG_DECORATION[slug] ?? BarsDecoration;
  const iconName = SLUG_ICON[slug] ?? "ph:math-operations-bold";

  return (
    <Link
      href={href}
      prefetch={false}
      data-hub-part="mobileTopicRow"
      className={styles.card}
      style={{ "--accent": accent } as React.CSSProperties}
      aria-label={`${name}${detail?.questionCount !== undefined ? `, ${detail.questionCount} questions` : ""}`}
    >
      <div className={styles.cardInner}>
        <div className={styles.cardTop}>
          {/* Iconify icon — loaded via CDN web component */}
          <div className={styles.iconTile} aria-hidden="true">
            {/* @ts-expect-error iconify-icon is a custom element loaded via CDN */}
            <iconify-icon icon={iconName} width="22" height="22" style={{ color: "#ffffff" }} />
          </div>
          <div className={styles.chevron} aria-hidden="true">
            <ChevronRight size={13} strokeWidth={2.5} />
          </div>
        </div>

        <div className={styles.cardMeta}>
          <span className={styles.topicTitle}>{name}</span>
          {detail && (
            <span className={styles.topicCount}>
              {detail.questionCount === undefined ? "—" : detail.questionCount} Questions
            </span>
          )}
        </div>

        <div className={styles.decorWrap} aria-hidden="true" style={{ color: accent }}>
          <DecorationComp />
        </div>
      </div>
    </Link>
  );
});
