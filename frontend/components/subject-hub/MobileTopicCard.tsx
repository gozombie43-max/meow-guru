"use client";
import Link from "next/link";
import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Box,
  ChevronRight,
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
  detail?: { color?: string; questionCount?: number; progress?: number; userSolved?: number };
}

function renderTopicIcon(slug: string, FallbackIcon?: LucideIcon) {
  const iconProps = { size: 19, strokeWidth: 1.8 };
  switch (slug) {
    case "percentages":
      return <Percent {...iconProps} />;
    case "ratio-and-proportion":
      return <Divide {...iconProps} />;
    case "profit-and-loss":
      return <TrendingUp {...iconProps} />;
    case "simple-interest":
      return <Landmark {...iconProps} />;
    case "compound-interest":
      return <Coins {...iconProps} />;
    case "time-and-work":
      return <Clock3 {...iconProps} />;
    case "time-and-distance":
      return <Gauge {...iconProps} />;
    case "algebra":
      return <span className={styles.algebraIcon}>f</span>;
    case "geometry":
      return <Compass {...iconProps} />;
    case "mensuration":
      return <Box {...iconProps} />;
    case "trigonometry":
      return <Waves {...iconProps} />;
    case "number-system":
      return <span className={styles.numberSystemIcon}>123</span>;
    case "averages":
      return <BarChart3 {...iconProps} />;
    case "discount":
      return <Tag {...iconProps} />;
    case "mixture-and-alligation":
      return <FlaskConical {...iconProps} />;
    case "partnership":
      return <Users2 {...iconProps} />;
    case "square-roots":
      return <Radical {...iconProps} />;
    case "statistics-probability":
      return <PieChart {...iconProps} />;
    default:
      if (FallbackIcon) return <FallbackIcon {...iconProps} />;
      return <Percent {...iconProps} />;
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
      aria-label={`${name}${isComingSoon ? ", Coming soon" : count !== undefined ? `, ${count} questions` : ""}`}
      aria-disabled={isComingSoon ? true : undefined}
      tabIndex={isComingSoon ? -1 : undefined}
    >
      {/* Top row: [icon] + [title / count] on left, chevron on right */}
      <div className={styles.cardTop}>
        <div className={styles.cardHeaderLeft}>
          <div className={styles.iconTile} aria-hidden="true">
            {renderTopicIcon(slug, FallbackIcon)}
          </div>
          <div className={styles.titleBlock}>
            <span className={styles.topicTitle}>{name}</span>
            <span className={styles.topicCount}>
              {isComingSoon
                ? "Coming soon"
                : count !== undefined
                  ? detail?.userSolved !== undefined && detail.userSolved > 0
                    ? `${detail.userSolved} / ${count} solved`
                    : `${count} questions`
                  : "—"}
            </span>
          </div>
        </div>
        <ChevronRight size={16} strokeWidth={2} className={styles.chevron} aria-hidden="true" />
      </div>

      {/* Bottom: Progress bar (omitted for coming soon) */}
      {!isComingSoon && progressPct !== undefined && progressPct > 0 && (
        <div className={styles.cardFooter}>
          <div className={styles.progressRow}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
              />
            </div>
            <span className={styles.progressLabel}>{progressPct}%</span>
          </div>
        </div>
      )}
    </Link>
  );
});
