"use client";
import Link from "next/link";
import { prefetchOnce } from "@/lib/intent-prefetch";
import { useRouter } from 'next/navigation';
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
  detail?: { color?: string; questionCount?: number; progress?: number; userSolved?: number };
}

export const MobileTopicCard = React.memo(function MobileTopicCard({
  href,
  slug,
  name,
  accent,
  priority = false,
  detail,
}: MobileTopicCardProps) {
  const router = useRouter();
  const count = detail?.questionCount ?? 0;
  const userSolved = detail?.userSolved ?? 0;

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={() => { prefetchOnce(router, href); }}
      onFocus={() => { prefetchOnce(router, href); }}
      onTouchStart={() => { prefetchOnce(router, href); }}
      data-hub-part="mobileTopicRow"
      className={styles.card}
      style={{ "--topic-accent": accent } as React.CSSProperties}
      aria-label={`${name}, ${count} questions`}
    >
      <div className={styles.iconTile} aria-hidden="true">
        <TopicThumbnail src={topicImage(slug)} size={56} priority={priority} />
      </div>
      <div className={styles.topicCopy}>
        <span className={styles.topicTitle}>{name}</span>
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
      </div>
      <ChevronRight size={19} strokeWidth={1.8} className={styles.chevron} aria-hidden="true" />
    </Link>
  );
});
