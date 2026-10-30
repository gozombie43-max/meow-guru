"use client";
import Link from "next/link";
import { prefetchOnce } from "@/lib/intent-prefetch";
import { useRouter } from "next/navigation";
import React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { topicImage } from "@/lib/topic-images";
import TopicThumbnail from "./TopicThumbnail";
import styles from "./mobile-topic-card.module.css";

export interface MobileTopicCardProps {
  href: string;
  slug: string;
  name: string;
  /** Kept for compatibility with shared topic metadata. */
  icon?: LucideIcon;
  accent: string;
  priority?: boolean;
  isRecent?: boolean;
  onSelect?: () => void;
  detail?: { color?: string; questionCount?: number; progress?: number; userSolved?: number };
}

export const MobileTopicCard = React.memo(function MobileTopicCard({
  href,
  slug,
  name,
  accent,
  priority = false,
  isRecent = false,
  onSelect,
  detail,
}: MobileTopicCardProps) {
  const router = useRouter();
  const count = detail?.questionCount ?? 0;
  const userSolved = detail?.userSolved ?? 0;
  const percent = count > 0 ? Math.min(100, Math.round((userSolved / count) * 100)) : 0;
  const barFillWidth = percent > 0 ? Math.max(8, percent) : 6;

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onSelect}
      onPointerEnter={() => { prefetchOnce(router, href); }}
      onFocus={() => { prefetchOnce(router, href); }}
      onTouchStart={() => { prefetchOnce(router, href); }}
      data-hub-part="mobileTopicRow"
      data-recent={isRecent ? "true" : undefined}
      className={`${styles.card} ${isRecent ? styles.cardRecent : ""}`}
      style={{ "--topic-accent": accent } as React.CSSProperties}
      aria-label={`${name}, ${count} questions${isRecent ? ", continue" : ""}`}
    >
      <div className={styles.iconTile} aria-hidden="true">
        <TopicThumbnail src={topicImage(slug)} size={56} priority={priority} />
      </div>
      <div className={styles.topicCopy}>
        <span className={styles.topicTitle}>{name}</span>
        <span className={styles.topicMetaRow}>
          <span className={styles.topicCount}>
            {count === 0 ? (
              <span className={styles.countTotal}>0 Questions</span>
            ) : (
              <>
                <span className={styles.countSolved}>
                  {userSolved.toLocaleString("en-US")}
                </span>
                <span className={styles.countDivider}>/</span>
                <span className={styles.countTotal}>{count.toLocaleString("en-US")}</span>{" "}
                <span className={styles.countLabel}>Solved</span>
              </>
            )}
          </span>
        </span>
      </div>
      {isRecent ? (
        <span className={styles.continueBadge}>
          <span>Continue</span>
          <svg
            className={styles.continueIcon}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2 1.5a.6.6 0 0 1 .93-.5l5.6 3.5a.6.6 0 0 1 0 1L2.93 9A.6.6 0 0 1 2 8.5v-7Z" />
          </svg>
        </span>
      ) : (
        <ChevronRight size={19} strokeWidth={1.8} className={styles.chevron} aria-hidden="true" />
      )}
      {isRecent && (
        <span className={styles.recentMeterTrack} aria-hidden="true">
          <span
            className={styles.recentMeterFill}
            style={{ width: `${barFillWidth}%` }}
          />
        </span>
      )}
    </Link>
  );
});
