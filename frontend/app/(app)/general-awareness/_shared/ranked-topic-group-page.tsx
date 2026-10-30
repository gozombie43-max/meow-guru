"use client";

// Shared chapter hub for General Awareness and IIT JAM Physics.

import TopicThumbnail from "@/components/subject-hub/TopicThumbnail";
import ChapterThumbnail from "./ChapterThumbnail";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import { recordRecentChapter, recordRecentTopic, useRecentChapter } from "@/lib/recent-study";
import { chapterImage } from "@/lib/topic-images";
import { useBackLayer } from "@/hooks/useAppNavigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import hubStyles from "@/components/SubjectHub.module.css";
import type {
RankedTopicGroup,
RankedTopicPriority,
} from "@/lib/ranked-topic-groups";
import Link from "next/link";
import { useEffect,useMemo,useRef,useState } from "react";
import styles from "./RankedTopicGroupPage.module.css";

type PriorityFilter = RankedTopicPriority | "All";

// Rows visible on first paint of a typical phone; the rest lazy-load near the viewport.
const EAGER_THUMBNAILS = 6;

const slugifyTitle = (title: string) =>
  title.trim().toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const PRIORITY_CLASS: Record<RankedTopicPriority, string> = {
  "Very High": styles.veryHigh,
  Core: styles.veryHigh,
  High: styles.high,
  Medium: styles.medium,
  Lower: styles.lower,
};

export default function RankedTopicGroupPage({ group, subject = "general-awareness", routeBase = `/general-awareness/${group.slug}`, backHref = "/general-awareness", backLabel = "General Awareness" }: {
  group: RankedTopicGroup;
  subject?: string;
  routeBase?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { data } = useTopicQuestionTotals(subject);
  // Uploads are keyed by chapter slug; fall back to the slugified chapter title.
  const questionTotal = (topic: { slug: string; title: string }) =>
    data?.totals?.[topic.slug] ?? data?.totals?.[slugifyTitle(topic.title)] ?? 0;
  const questionSolved = (topic: { slug: string; title: string }) =>
    data?.userProgress?.[topic.slug]?.userSolved ??
    data?.userProgress?.[topic.title]?.userSolved ??
    data?.userProgress?.[slugifyTitle(topic.title)]?.userSolved ??
    0;
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const recentChapterSlug = useRecentChapter(subject, group.slug);
  useBackLayer(filterOpen, () => setFilterOpen(false));

  useEffect(() => {
    recordRecentTopic(subject, group.slug);
  }, [subject, group.slug]);

  useEffect(() => {
    const dialog = filterDialogRef.current;
    if (!dialog) return;
    if (!filterOpen) {
      if (dialog.open) dialog.close();
      return;
    }
    const positionDialog = () => {
      const trigger = filterTriggerRef.current;
      if (!trigger) return;
      const bounds = trigger.getBoundingClientRect();
      const top = bounds.bottom + 8;
      dialog.style.top = `${top}px`;
      dialog.style.right = `${Math.max(12, window.innerWidth - bounds.right)}px`;
      dialog.style.maxHeight = `max(44px, calc(100dvh - ${top + 12}px))`;
    };
    positionDialog();
    if (!dialog.open) dialog.showModal();
    window.addEventListener('resize', positionDialog);
    return () => window.removeEventListener('resize', positionDialog);
  }, [filterOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPriority("All"), 0);
    return () => window.clearTimeout(timer);
  }, [group.slug, group.filters]);

  const topics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = group.topics.filter((topic) => {
      const matchesQuery =
        normalizedQuery === "" || topic.title.toLowerCase().includes(normalizedQuery);
      const matchesPriority =
        normalizedQuery !== "" || priority === "All" || topic.priority === priority;
      return matchesQuery && matchesPriority;
    });
    if (recentChapterSlug) {
      const recentIndex = filtered.findIndex((topic) => topic.slug === recentChapterSlug);
      if (recentIndex > 0) {
        const next = [...filtered];
        const [recentItem] = next.splice(recentIndex, 1);
        next.unshift(recentItem);
        return next;
      }
    }
    return filtered;
  }, [group.topics, priority, query, recentChapterSlug]);

  const filters = useMemo<readonly PriorityFilter[]>(
    () => ["All", ...group.filters],
    [group.filters]
  );

  const filterButton = (
    <button
      type="button"
      data-ui-button="state"
      data-ui-shape="icon"
      className={`${styles.headerFilter} ${priority !== "All" ? styles.headerFilterActive : ""}`}
      aria-label={`Filter chapters, ${priority} selected`}
      aria-haspopup="dialog"
      aria-expanded={filterOpen}
      aria-controls="chapter-filter-dialog"
      onClick={(event) => {
        filterTriggerRef.current = event.currentTarget;
        setFilterOpen(true);
      }}
    >
      <SlidersHorizontal size={20} aria-hidden="true" />
      {priority !== "All" && <span className={styles.filterActiveDot} aria-hidden="true" />}
    </button>
  );

  return (
    <div className={styles.page}>
      {/* =========================================================================
          DESKTOP VIEW (>= 768px)
          ========================================================================= */}
      <div className={styles.desktopContainer}>
        <header data-ui-chrome="header" className={styles.header}>
          <Link replace data-ui-button="secondary"
            href={backHref}
            className={styles.backButton}
            aria-label={`Back to ${backLabel}`}
          >
            <ChevronLeft size={23} strokeWidth={2.2} />
          </Link>
          <h1 className={styles.headerTitle}>{group.label}</h1>
          {group.filters.length > 0 ? filterButton : null}
        </header>

        <main className={styles.content}>
          <section className={styles.intro} aria-labelledby="ranked-topics-heading">
            <p className={styles.eyebrow}>{group.eyebrow}</p>
            <h2 id="ranked-topics-heading" className={styles.heading}>
              {group.topics.length} chapters{group.filters.length ? ", ranked" : ""}
            </h2>
            <p className={styles.description}>
              {group.description}
            </p>
          </section>

          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} size={17} aria-hidden="true" />
            <input
              className={styles.searchInput}
              type="search"
              data-custom-focus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chapters"
              aria-label={`Search ${group.label} chapters`}
            />
            {query ? (
              <button
                type="button"
                data-custom-focus
                data-ui-interaction="none"
                className={styles.clearButton}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery("")}
                aria-label="Clear chapter search"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <section className={styles.table} aria-label={`Ranked ${group.label} chapters`}>
            <div className={styles.tableHeader} aria-hidden="true">
              <span>Rank</span>
              <span>Chapter</span>
              <span>{group.filters.length ? group.metricLabel : ""}</span>
            </div>

            {topics.length > 0 ? (
              topics.map((topic) => {
                const total = questionTotal(topic);
                const solved = Math.min(questionSolved(topic), total);
                return (
                  <Link
                    key={topic.slug}
                    className={styles.row}
                    href={`${routeBase}/${topic.slug}`}
                    onClick={() => recordRecentChapter(subject, group.slug, topic.slug)}
                    aria-label={group.filters.length ? `Rank ${topic.rank}: ${topic.title}, ${topic.priority} ${group.metricLabel.toLowerCase()}. Open topic.` : `${topic.rank}. ${topic.title}. Open chapter.`}
                  >
                    <span className={styles.rank}>{topic.rank}</span>
                    <span className={styles.chapterCell}>
                      <span className={styles.chapterPhoto} aria-hidden="true"><TopicThumbnail src={chapterImage(topic.slug, group.slug)} size={48} /></span>
                      <span className={styles.chapter}>
                        {topic.title}
                        <span className={styles.chapterQuestionCount}>
                          <span className={styles.attemptedCount}>{solved}</span>
                          <span className={styles.attemptedSlash}>/</span>
                          <span className={styles.totalCount}>{total}</span>{" "}
                          <span className={styles.attemptedLabel}>attempted</span>
                        </span>
                      </span>
                    </span>
                    <span className={styles.weightage} hidden={!group.filters.length}>
                      <span
                        className={`${styles.weightDot} ${PRIORITY_CLASS[topic.priority]}`}
                        aria-hidden="true"
                      />
                      {topic.priority}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className={styles.empty}>No chapters match your search.</div>
            )}
          </section>
        </main>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (< 768px Handheld Devices)
          ========================================================================= */}
      <div className={`${hubStyles.mobileContainer} ${hubStyles.fixedTopicsMobile} ${hubStyles.oledMobile} ${styles.mobileLayout}`}>
        {/* Mobile Topbar */}
        <header data-ui-chrome="header" data-hub-part="mobileTopbar" className={`${hubStyles.mobileTopbar} ${styles.mobileHeader}`}>
          <Link replace
            href={backHref}
            className={`${hubStyles.mobileBackBtn} ${styles.mobileBackBtn}`}
            aria-label={`Back to ${backLabel}`}
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </Link>
          <h1 className={`${hubStyles.mobileTopbarTitle} ${styles.mobileTopbarTitle}`}>
            {group.label} Chapters
          </h1>
          {group.filters.length > 0 ? filterButton : null}
        </header>

        <div data-hub-part="mobileBody" className={hubStyles.mobileBody}>
          {/* Mobile Search Row — pinned above the scrollable chapter list */}
          <div
            data-hub-part="mobileSearchRow"
            className={styles.chapterSearch}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                mobileSearchInputRef.current?.focus();
              }
            }}
          >
            <Search size={15} className={styles.mobileSearchIcon} aria-hidden="true" />
            <input
              ref={mobileSearchInputRef}
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={styles.chapterSearchInput}
              data-custom-focus
              data-mobile-chapter-search
              enterKeyHint="search"
              placeholder="Search chapters"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${group.label} chapters`}
            />
            {query && (
              <div className={styles.chapterSearchActions}>
                <button
                  type="button"
                  data-custom-focus
                  data-ui-interaction="none"
                  className={styles.clearSearchBtn}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("");
                    mobileSearchInputRef.current?.focus();
                  }}
                  aria-label="Clear Search"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Elevated chapter list with brand accents and attempted progress */}
          <div
            data-hub-part="mobileTopicGroup"
            className={styles.chapterList}
          >
            {topics.length === 0 ? (
              <div className={styles.mobileEmpty}>
                No {group.label.toLowerCase()} chapters found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              topics.map((topic, index) => {
                const total = questionTotal(topic);
                const solved = Math.min(questionSolved(topic), total);
                const isRecent = topic.slug === recentChapterSlug;
                const percent = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;
                const barFillWidth = percent > 0 ? Math.max(8, percent) : 6;
                return (
                  <Link
                    key={topic.slug}
                    href={`${routeBase}/${topic.slug}`}
                    onClick={() => recordRecentChapter(subject, group.slug, topic.slug)}
                    data-hub-part="mobileTopicRow"
                    data-recent={isRecent ? "true" : undefined}
                    className={`${styles.chapterRow} ${isRecent ? styles.chapterRowRecent : ""}`}
                    aria-label={`${topic.rank}. ${topic.title}${isRecent ? ", continue" : ""}`}
                  >
                    <div className={styles.chapterIcon}>
                      <ChapterThumbnail src={chapterImage(topic.slug, group.slug)} eager={index < EAGER_THUMBNAILS} className={styles.chapterImg} />
                      <span
                        className={styles.mobileRankNum}
                        aria-hidden="true"
                      >
                        {topic.rank}
                      </span>
                    </div>
                    <span className={styles.chapterText}>
                      <span className={styles.mobileTopicName}>{topic.title}</span>
                      <span className={styles.chapterMetaRow}>
                        <span className={styles.chapterQuestionCount}>
                          <span className={styles.attemptedCount}>{solved}</span>
                          <span className={styles.attemptedSlash}>/</span>
                          <span className={styles.totalCount}>{total}</span>{" "}
                          <span className={styles.attemptedLabel}>attempted</span>
                        </span>
                      </span>
                    </span>
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
                      <ChevronRight className={styles.chapterChevron} size={18} aria-hidden="true" />
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
              })
            )}
          </div>
        </div>
      </div>
      <dialog
        ref={filterDialogRef}
        id="chapter-filter-dialog"
        className={styles.filterDialog}
        aria-labelledby="chapter-filter-title"
        onCancel={(event) => { event.preventDefault(); setFilterOpen(false); }}
        onClose={() => setFilterOpen(false)}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) setFilterOpen(false);
        }}
      >
        <div className={styles.filterDialogHeader}>
          <span id="chapter-filter-title" className={styles.filterDialogTitle}>{group.metricLabel}</span>
          {priority !== "All" && (
            <button
              type="button"
              data-custom-focus
              className={styles.filterResetBtn}
              onClick={() => { setPriority("All"); setFilterOpen(false); }}
            >
              Reset
            </button>
          )}
        </div>
        <div className={styles.filterOptions} aria-label={`Filter by ${group.metricLabel.toLowerCase()}`}>
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              data-custom-focus
              className={styles.filterOption}
              aria-pressed={priority === filter}
              onClick={() => { setPriority(filter); setFilterOpen(false); }}
            >
              <span>{filter}</span>
              {priority === filter && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
