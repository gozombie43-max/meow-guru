"use client";
import Link from "next/link";
import { prefetchOnce } from "@/lib/intent-prefetch";
import { useRouter } from 'next/navigation';
import React from "react";
import type { LucideIcon } from "lucide-react";
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
  detail?: { color?: string; questionCount?: number; progress?: number; userSolved?: number };
}

export const MobileTopicCard = React.memo(function MobileTopicCard({
  href,
  slug,
  name,

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
      aria-label={`${name}, ${count} questions`}
    >
      {/* 1. Top Section: Icon + Title + Meta with fixed baseline */}
      <div className={styles.cardBody}>
        <div className={styles.iconTile} aria-hidden="true">
          <TopicThumbnail src={topicImage(slug)} />
        </div>

        <div className={styles.topicTitleWrap}>
          <span className={styles.topicTitle} title={name}>
            {name}
          </span>
        </div>

        <span className={styles.topicCount}>
          {count === 0
            ? "0 Questions"
            : `${userSolved} / ${count} solved`}
        </span>
      </div>

    </Link>
  );
});
