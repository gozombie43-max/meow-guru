"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

export const MobileTopicRow = React.memo(function MobileTopicRow({
  href,
  color,
  Icon,
  name,
  styles,
  detail,
  quiet = false,
}: {
  quiet?: boolean;
  detail?: { color: string; questionCount?: number };
  href: string;
  color?: string;
  Icon?: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  name: string;
  styles: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onTouchStart={() => router.prefetch(href)}
      data-hub-part="mobileTopicRow"
      className={styles.mobileTopicRow}
    >
      <div className={styles.mobileTopicRowLeft}>
        {Icon ? (
          <div
            className={styles.mobileTopicIconBox}
            style={detail || quiet ? { "--topic-color": detail?.color ?? `color-mix(in srgb, ${color || "#4799e8"} 65%, #b6becb)` } as React.CSSProperties : { background: color || "#38bdf8" }}
          >
            <Icon size={18} strokeWidth={2.2} color="#ffffff" />
          </div>
        ) : null}
        <span className={styles.mobileTopicText}>
          <span className={styles.mobileTopicName}>{name}</span>
          {detail && <span className={styles.mobileTopicCount}>{detail.questionCount === undefined ? "—" : detail.questionCount} Questions</span>}
        </span>
      </div>

      <ChevronRight
        size={16}
        strokeWidth={2.4}
        className={styles.mobileChevron}
      />
    </Link>
  );
});
