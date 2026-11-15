"use client";

import TopicThumbnail from "./TopicThumbnail";
import { topicImage } from "@/lib/topic-images";
import { ArrowLeft, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import React from "react";
import type { SubjectHubView } from "./useSubjectHubView";

export function SubjectHubDesktop({ view }: { view: SubjectHubView }) {
  const {
    config,
    HubIcon,
    styles,
    router,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    isChapterMode,
    filteredTopics,
    recentTopicSlug,
  } = view;

  const totalQuestions = React.useMemo(() => {
    return filteredTopics.reduce((sum, topic) => {
      const detail = config.mobileTopicDetails?.[topic.slug];
      return sum + (detail?.questionCount ?? 0);
    }, 0);
  }, [filteredTopics, config.mobileTopicDetails]);

  const orderedTopics = React.useMemo(() => {
    if (!recentTopicSlug) return filteredTopics;
    const idx = filteredTopics.findIndex((t) => t.slug === recentTopicSlug);
    if (idx <= 0) return filteredTopics;
    const next = [...filteredTopics];
    const [recent] = next.splice(idx, 1);
    next.unshift(recent);
    return next;
  }, [filteredTopics, recentTopicSlug]);

  return (
    <div className={styles.desktopContainer}>
      {/* ── Top Workspace Bar (56px) ── */}
      <header className={styles.titlebar}>
        <div className={styles.titlebarLeft}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => router.replace("/")}
            aria-label="Back to home"
            title="Back to home"
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
          </button>

          <span className={styles.titlebarDivider} aria-hidden="true" />

          <div className={styles.windowTitleGroup}>
            <span className={styles.windowIcon} aria-hidden="true">
              <HubIcon size={16} strokeWidth={1.75} />
            </span>
            <h1 className={styles.windowTitle}>{config.label}</h1>
            <span className={styles.windowMeta}>
              {orderedTopics.length} topics
              {!config.totalsPending && totalQuestions > 0 && ` · ${totalQuestions.toLocaleString()} questions`}
            </span>
          </div>
        </div>

        <div className={styles.titlebarRight}>
          {/* Search Input */}
          <div className={styles.searchWrap}>
            <Search size={15} strokeWidth={1.75} className={styles.searchIcon} />
            <input
              ref={searchInputRef}
              type="search"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              placeholder="Search topics..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={`Search ${config.subjectId} topics`}
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={13} strokeWidth={1.75} />
              </button>
            ) : (
              <kbd className={styles.searchShortcut}>⌘K</kbd>
            )}
          </div>
        </div>
      </header>

      {/* ── Single-Pane List Body ── */}
      <main
        className={styles.mainCanvas}
        aria-label={`${config.label} topics`}
      >
        <div className={styles.canvasViewport}>
          <div className={styles.listContainer}>
            {orderedTopics.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon} aria-hidden="true">
                  <Search size={18} strokeWidth={1.75} />
                </div>
                <div className={styles.emptyStateTitle}>No topics found</div>
                <p className={styles.emptyStateDesc}>
                  No topics matched &ldquo;{searchQuery}&rdquo;.
                </p>
                <button
                  type="button"
                  className={styles.tableActionBtn}
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className={styles.tableCard}>
                <table className={styles.denseTable}>
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Subtopics</th>
                      <th>Exam weight</th>
                      <th>Questions</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedTopics.map((topic, index) => {
                      const detail = config.mobileTopicDetails?.[topic.slug];
                      const count = detail?.questionCount ?? 0;
                      const solved = detail?.userSolved ?? 0;
                      const isRecent = topic.slug === recentTopicSlug;
                      const topicHref = isChapterMode
                        ? `${config.chapterBasePrefix}/${topic.slug}`
                        : topic.routeBase;

                      return (
                        <tr
                          key={topic.id}
                          className={styles.denseTableRow}
                          onClick={() => router.push(topicHref)}
                        >
                          <td>
                            <div className={styles.tableTopicCell}>
                              <div className={styles.tableTopicIcon}>
                                <TopicThumbnail
                                  src={topicImage(topic.slug)}
                                  size={40}
                                  priority={index < 4}
                                />
                              </div>
                              <span className={styles.tableTopicName}>
                                {topic.name}
                              </span>
                              {isRecent && (
                                <span className={styles.recentTag}>
                                  Recent
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div
                              className={styles.tableSubtopics}
                              title={topic.subtopics.join(", ")}
                            >
                              {topic.subtopics.join(" · ")}
                            </div>
                          </td>
                          <td>
                            <span className={styles.tableWeightBadge}>
                              {topic.questions} Qs
                              {topic.expectedMarks && ` · ${topic.expectedMarks}`}
                            </span>
                          </td>
                          <td>
                            <span className={styles.tableProgressText}>
                              {config.totalsPending ? (
                                <span className={styles.tableCountSkeleton} aria-hidden="true" />
                              ) : count > 0 ? (
                                <>
                                  {config.progressPending ? (
                                    <span className={styles.tableSolvedSkeleton} aria-hidden="true" />
                                  ) : (
                                    <span className={styles.tableSolvedNum}>
                                      {solved.toLocaleString()}
                                    </span>
                                  )}
                                  <span> / {count.toLocaleString()} solved</span>
                                </>
                              ) : (
                                "0 Qs"
                              )}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link
                              href={topicHref}
                              prefetch={false}
                              className={
                                isRecent
                                  ? styles.tableContinueBtn
                                  : styles.tableActionBtn
                              }
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`${isRecent ? "Continue" : "Open"} ${topic.name}`}
                            >
                              <span>{isRecent ? "Continue" : "Open"}</span>
                              <ChevronRight size={14} strokeWidth={1.75} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
