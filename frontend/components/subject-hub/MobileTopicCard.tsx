"use client";
import Link from "next/link";
import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Box,
  ChevronRight,
  Clock,
  Clock3,
  Coins,
  Compass,
  Divide,
  FlaskConical,
  Gauge,
  Landmark,
  Percent,
  PieChart,
  Radical,
  Tag,
  TrendingUp,
  Users2,
  Waves,
} from "lucide-react";
import styles from "./mobile-topic-card.module.css";

export interface MobileTopicCardProps {
  href: string;
  slug: string;
  name: string;
  /** Kept for type compatibility */
  icon?: LucideIcon;
  accent: string;
  detail?: { color?: string; questionCount?: number; progress?: number };
}

function renderTopicIcon(slug: string, FallbackIcon?: LucideIcon) {
  switch (slug) {
    case "percentages":
      return <Percent size={20} strokeWidth={2.2} />;
    case "ratio-and-proportion":
      return <Divide size={20} strokeWidth={2.2} />;
    case "profit-and-loss":
      return <TrendingUp size={20} strokeWidth={2.2} />;
    case "simple-interest":
      return <Landmark size={20} strokeWidth={2.2} />;
    case "compound-interest":
      return <Coins size={20} strokeWidth={2.2} />;
    case "time-and-work":
      return <Clock3 size={20} strokeWidth={2.2} />;
    case "time-and-distance":
      return <Gauge size={20} strokeWidth={2.2} />;
    case "algebra":
      return <span className={styles.algebraIcon}>f</span>;
    case "geometry":
      return <Compass size={20} strokeWidth={2.2} />;
    case "mensuration":
      return <Box size={20} strokeWidth={2.2} />;
    case "trigonometry":
      return <Waves size={20} strokeWidth={2.2} />;
    case "number-system":
      return <span className={styles.numberSystemIcon}>123</span>;
    case "averages":
      return <BarChart3 size={20} strokeWidth={2.2} />;
    case "discount":
      return <Tag size={20} strokeWidth={2.2} />;
    case "mixture-and-alligation":
      return <FlaskConical size={20} strokeWidth={2.2} />;
    case "partnership":
      return <Users2 size={20} strokeWidth={2.2} />;
    case "square-roots":
      return <Radical size={20} strokeWidth={2.2} />;
    case "statistics-probability":
      return <PieChart size={20} strokeWidth={2.2} />;
    default:
      if (FallbackIcon) return <FallbackIcon size={20} strokeWidth={2.2} />;
      return <Percent size={20} strokeWidth={2.2} />;
  }
}

export const MobileTopicCard = React.memo(function MobileTopicCard({
  href,
  slug,
  name,
  icon: FallbackIcon,
  accent,
  detail,
}: MobileTopicCardProps) {
  const count = detail?.questionCount;
  const isComingSoon = count === 0;
  const progressPct = detail?.progress;

  return (
    <Link
      href={href}
      prefetch={false}
      data-hub-part="mobileTopicRow"
      className={`${styles.card} ${isComingSoon ? styles.cardComingSoon : ""}`}
      style={{ "--accent": accent } as React.CSSProperties}
      aria-label={`${name}${count !== undefined ? `, ${count} questions` : ""}`}
    >
      {/* Top row: Icon tile left, plain chevron right */}
      <div className={styles.cardHeader}>
        <div className={styles.iconTile} aria-hidden="true">
          {renderTopicIcon(slug, FallbackIcon)}
        </div>
        {!isComingSoon && (
          <ChevronRight size={17} strokeWidth={2} className={styles.chevron} aria-hidden="true" />
        )}
      </div>

      {/* Title and question count */}
      <div className={styles.cardBody}>
        <span className={styles.topicTitle}>{name}</span>
        <span className={styles.topicCount}>
          {count !== undefined ? `${count} questions` : "—"}
        </span>
      </div>

      {/* Bottom: Progress bar or Coming soon indicator */}
      <div className={styles.cardFooter}>
        {isComingSoon ? (
          <div className={styles.comingSoonBadge}>
            <Clock size={12} strokeWidth={2} aria-hidden="true" />
            <span>Coming soon</span>
          </div>
        ) : progressPct !== undefined && progressPct > 0 ? (
          <div className={styles.progressRow}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
              />
            </div>
            <span className={styles.progressLabel}>{progressPct}%</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
});
