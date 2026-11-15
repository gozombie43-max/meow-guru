"use client";

import defaultStyles from "@/components/SubjectHub.module.css";
import { ArrowLeft, ArrowUpDown, Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { MobileTopicCard } from "./MobileTopicCard";
import { MobileSearchBar } from "./MobileSearchBar";
import type { SubjectHubView } from "./useSubjectHubView";
import skeletonStyles from "./mobile-topic-card.module.css";

// Rows rendered per page; more pages stream in as the user nears the end.
const TOPIC_PAGE_SIZE = 10;
const SKELETON_ROWS = 3;
const noopSubscribe = () => () => {};
const getObserverSupported = () => typeof IntersectionObserver !== "undefined";
const getServerObserverSupported = () => true;

function useIncrementalCount(total: number, resetKey: string, rootRef: RefObject<HTMLElement | null>) {
  // Server and first client hydration pass both render page 1 (no mismatch);
  // environments without IntersectionObserver (e.g. jsdom) show all rows.
  const hasObserver = useSyncExternalStore(
    noopSubscribe,
    getObserverSupported,
    getServerObserverSupported,
  );
  const [count, setCount] = useState(TOPIC_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // New search/filter/sort result → start again from the first page.
  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    setCount(TOPIC_PAGE_SIZE);
    rootRef.current?.scrollTo?.({ top: 0 });
  }, [resetKey, rootRef]);

  const hasMore = hasObserver && count < total;

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === "undefined") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCount((prev) => Math.min(prev + TOPIC_PAGE_SIZE, total));
        }
      },
      { root: rootRef.current, rootMargin: "0px 0px 120px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, total, count, rootRef]);

  return { visible: hasObserver ? Math.min(count, total) : total, hasMore, sentinelRef };
}

export function SubjectHubMobile({ view }: { view: SubjectHubView }) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const {
    config,
    CATEGORIES,
    router,
    searchQuery,
    setSearchQuery,
    mobileCategory,
    setMobileCategory,
    mobileFilterOpen,
    setMobileFilterOpen,
    sortBy,
    setSortBy,
    sortMenuOpen,
    setSortMenuOpen,
    sortOptions,
    recentTopicSlug,
    mobileTopics,
    isChapterMode,
  } = view;
  const allTopics = mobileTopics ?? [];
  const resetKey = `${searchQuery}\0${mobileCategory}\0${sortBy}`;
  const { visible, hasMore, sentinelRef } = useIncrementalCount(allTopics.length, resetKey, scrollAreaRef);

  return (
    <div className={`${defaultStyles.mobileContainer} ${defaultStyles.oledMobile}`}>
      {/* Mobile Topbar */}
      <header data-ui-chrome="header" data-hub-part="mobileTopbar" className={`${defaultStyles.mobileTopbar} ${defaultStyles.oledMobileTopbar}`}>
        <button
          data-ui-button="icon"
          type="button"
          className={defaultStyles.mobileBackBtn}
          onClick={() => router.replace("/")}
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <span className={defaultStyles.mobileTopbarTitle}>
          {config.label}
        </span>
        {/* Header Right: Filter Button & Dropdown */}
        <div className={defaultStyles.mobileHeaderFilterWrap}>
          <button
            data-ui-button="icon"
            data-hub-part="mobileFilterToggle"
            type="button"
            className={`${defaultStyles.mobileHeaderFilterBtn} ${mobileFilterOpen ? defaultStyles.mobileHeaderFilterBtnActive : ""} ${mobileCategory !== "all" ? defaultStyles.mobileHeaderFilterHasSelection : ""}`}
            onClick={() => setMobileFilterOpen((prev) => !prev)}
            aria-label="Filter topics"
            aria-expanded={mobileFilterOpen}
            aria-haspopup="menu"
            title="Filter topics"
          >
            <SlidersHorizontal size={19} strokeWidth={2.2} />
            {mobileCategory !== "all" && (
              <span className={defaultStyles.filterActiveDot} aria-hidden="true" />
            )}
          </button>

          {/* Compact Filter Dropdown Popover */}
          <div
            data-hub-part="mobileTabsScroll"
            className={`${defaultStyles.mobileFilterDropdown} ${mobileFilterOpen ? defaultStyles.mobileFilterDropdownOpen : ""}`}
            aria-label="Filter categories"
          >
            <div className={defaultStyles.mobileFilterDropdownHeader}>
              <span>Priority</span>
              {mobileCategory !== "all" && (
                <button
                  type="button"
                  data-custom-focus
                  className={defaultStyles.mobileFilterResetBtn}
                  onClick={() => {
                    setMobileCategory("all");
                    setMobileFilterOpen(false);
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            <div className={defaultStyles.mobileFilterOptionsList}>
              {[{ id: "all", label: "All" }, ...CATEGORIES].map((cat) => {
                const isSelected = mobileCategory === cat.id;
                return (
                  <button
                    data-custom-focus
                    key={cat.id}
                    type="button"
                    className={`${defaultStyles.mobileFilterOptionItem} ${isSelected ? defaultStyles.mobileFilterOptionItemActive : ""}`}
                    onClick={() => {
                      setMobileCategory(cat.id);
                      setMobileFilterOpen(false);
                    }}
                    aria-pressed={isSelected}
                  >
                    <span className={defaultStyles.mobileFilterOptionLabel}>{cat.label}</span>
                    {isSelected && (
                      <Check size={13} strokeWidth={2.5} className={defaultStyles.mobileFilterCheckIcon} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {mobileFilterOpen && (
        <div
          className={defaultStyles.mobileFilterBackdrop}
          onClick={() => setMobileFilterOpen(false)}
          aria-hidden="true"
        />
      )}

      {sortMenuOpen && (
        <div
          className={defaultStyles.mobileFilterBackdrop}
          onClick={() => setSortMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div data-hub-part="mobileBody" className={defaultStyles.mobileBody}>
        {/* Mobile Search Row — shared pill-style search bar pinned above scrollable list */}
        <MobileSearchBar
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={config.mobileSearchPlaceholder || "Search topics"}
          ariaLabel="Search topics"
        />

        {/* Metadata & Sort Bar */}
        {(() => {
          const totalQuestions = (mobileTopics ?? []).reduce((sum, t) => {
            const detail = config.mobileTopicDetails?.[t.slug];
            return sum + (detail?.questionCount ?? 0);
          }, 0);
          return (
            <div className={defaultStyles.oledMetaBar}>
              <span className={defaultStyles.oledMetaCount}>
                {mobileTopics?.length ?? 0} topics
                {!config.totalsPending && ` · ${totalQuestions.toLocaleString()} questions`}
              </span>
              <div className={defaultStyles.oledSortWrap}>
                <button
                  type="button"
                  data-custom-focus
                  className={`${defaultStyles.oledSortBtn} ${sortMenuOpen ? defaultStyles.oledSortBtnActive : ""}`}
                  onClick={() => setSortMenuOpen((prev) => !prev)}
                  aria-label="Sort topics"
                  aria-expanded={sortMenuOpen}
                >
                  <ArrowUpDown size={12} strokeWidth={2.2} />
                  <span>Sort</span>
                  <ChevronDown size={11} strokeWidth={2.2} />
                </button>

                {sortMenuOpen && (
                  <div className={defaultStyles.oledSortDropdown} role="menu">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        data-custom-focus
                        className={`${defaultStyles.oledSortOption} ${sortBy === opt.id ? defaultStyles.oledSortOptionActive : ""}`}
                        onClick={() => {
                          setSortBy(opt.id);
                          setSortMenuOpen(false);
                        }}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && <Check size={13} strokeWidth={2.5} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Topic Cards */}
        <div ref={scrollAreaRef} className={defaultStyles.oledTopicScrollArea}>
          <div className={defaultStyles.oledTopicGrid}>
            {allTopics.slice(0, visible).map((topic, index) => {
              const detail = config.mobileTopicDetails?.[topic.slug];
              const isRecent = topic.slug === recentTopicSlug;
              return (
                <MobileTopicCard
                  key={topic.id}
                  href={isChapterMode ? `${config.chapterBasePrefix}/${topic.slug}` : `${topic.routeBase}`}
                  slug={topic.slug}
                  name={topic.name}
                  icon={topic.icon}
                  accent={detail?.color ?? topic.color}
                  detail={detail}
                  totalsPending={config.totalsPending}
                  progressPending={config.progressPending}
                  priority={index < 8}
                  isRecent={isRecent}
                  prefetchCounts={!isChapterMode ? { subject: config.subjectId, topic: topic.questionTopic ?? topic.slug } : undefined}
                />
              );
            })}
            {hasMore &&
              Array.from({ length: Math.min(SKELETON_ROWS, allTopics.length - visible) }, (_, i) => (
                <div key={`topic-skeleton-${i}`} className={skeletonStyles.skeletonRow} aria-hidden="true">
                  <span className={skeletonStyles.skeletonTile} />
                  <span className={skeletonStyles.skeletonCopy}>
                    <span className={skeletonStyles.skeletonLine} />
                    <span className={`${skeletonStyles.skeletonLine} ${skeletonStyles.skeletonLineShort}`} />
                  </span>
                </div>
              ))}
          </div>
          {hasMore && <div ref={sentinelRef} className={skeletonStyles.sentinel} aria-hidden="true" />}
          {mobileTopics?.length === 0 && (
            <p role="status" className={defaultStyles.mobileTopicCount}>
              No topics found. Try another search or filter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
