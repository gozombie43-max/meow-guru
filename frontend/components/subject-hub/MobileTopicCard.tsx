"use client";
import Link from "next/link";
import { prefetchOnce } from "@/lib/intent-prefetch";
import { useRouter } from 'next/navigation';
import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Box,
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
  Asterisk,
  Layers,
  History,
  Droplets,
  CalendarDays,
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
  const iconProps = { size: 15.5, strokeWidth: 1.85 };
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
    case "simplification":
      return <Asterisk {...iconProps} />;
    case "lcm-and-hcf":
      return <Layers {...iconProps} />;
    case "problems-on-ages":
      return <History {...iconProps} />;
    case "pipes-and-cisterns":
      return <Droplets {...iconProps} />;
    case "calendar-and-clock":
      return <CalendarDays {...iconProps} />;
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
  detail,
}: MobileTopicCardProps) {
  const router = useRouter();
  const count = detail?.questionCount;
  const isComingSoon = count === 0;
  const userSolved = detail?.userSolved ?? 0;

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={() => { if (!isComingSoon) prefetchOnce(router, href); }}
      onFocus={() => { if (!isComingSoon) prefetchOnce(router, href); }}
      onTouchStart={() => { if (!isComingSoon) prefetchOnce(router, href); }}
      data-hub-part="mobileTopicRow"
      className={`${styles.card} ${isComingSoon ? styles.cardComingSoon : ""}`}
      aria-label={`${name}${isComingSoon ? ", Coming soon" : count !== undefined ? `, ${count} questions` : ""}`}
      aria-disabled={isComingSoon ? true : undefined}
      tabIndex={isComingSoon ? -1 : undefined}
    >
      {/* 1. Top Section: Icon + Title + Meta with fixed baseline */}
      <div className={styles.cardBody}>
        <div className={styles.iconTile} aria-hidden="true">
          {renderTopicIcon(slug, FallbackIcon)}
        </div>

        <div className={styles.topicTitleWrap}>
          <span className={styles.topicTitle} title={name}>
            {name}
          </span>
        </div>

        <span className={styles.topicCount}>
          {isComingSoon
            ? "Coming soon"
            : count !== undefined
              ? `${userSolved} / ${count} solved`
              : "—"}
        </span>
      </div>

    </Link>
  );
});
