"use client";
import { useSubjectHub } from "@/components/subject-hub/useSubjectHub";

import MacTrafficLights from "@/components/MacTrafficLights";
import MicIcon from "@/components/MicIcon";
import defaultStyles from "@/components/SubjectHub.module.css";
import { useQuestionCounts } from "@/hooks/useQuestionCounts";
import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  Moon,
  Search,
  Sidebar as SidebarIcon,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SubjectHubConfig } from "./types";

const EMPTY_STUDY_TOPICS = new Set<string>();

export default function SubjectHub({ config }: { config: SubjectHubConfig }) {
  const {
    topics: TOPICS,
    categories: CATEGORIES,
    priorityConfig: PRIORITY_CONFIG,
    practiceModes: PRACTICE_MODES,
    icon: HubIcon,
  } = config;
  const STUDY_MODE_TOPICS = config.studyModeTopics ?? EMPTY_STUDY_TOPICS;
  const styles = config.styles ?? defaultStyles;
  const router = useRouter();
  const {
    theme,
    toggleThemeMode,
    isDark,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    selectedTopicId,
    setSelectedTopicId,
    sidebarOpen,
    setSidebarOpen,
    searchInputRef,
    isListening,
    toggleVoiceSearch,
  } = useSubjectHub();

  // States
  const [activeCategory, setActiveCategory] = useState<string>("very-high");
  const [selectedChapterSlug, setSelectedChapterSlug] = useState<string>("");

  // Chapter Mode Check
  const isChapterMode = !!config.getChapterGroup;

  // Filtered topics (for sidebar / grid)
  const filteredTopics = useMemo(() => {
    if (isChapterMode) {
      const q = searchQuery.trim().toLowerCase();
      return TOPICS.filter((t) => {
        return (
          q === "" ||
          t.name.toLowerCase().includes(q) ||
          t.subtopics.some((s) => s.toLowerCase().includes(q)) ||
          t.description.toLowerCase().includes(q)
        );
      });
    }
    return TOPICS.filter((t) => {
      const matchCat = t.priority === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        t.name.toLowerCase().includes(q) ||
        t.subtopics.some((s) => s.toLowerCase().includes(q)) ||
        t.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [isChapterMode, activeCategory, searchQuery, TOPICS]);

  // Selected topic object
  const selectedTopic = useMemo(() => {
    return (
      filteredTopics.find((t) => t.id === selectedTopicId) ||
      filteredTopics[0] ||
      TOPICS[0]
    );
  }, [selectedTopicId, filteredTopics, TOPICS]);

  // Topic Group & Chapters (if chapter hierarchy mode is active)
  const currentGroup = useMemo(() => {
    if (!config.getChapterGroup) return null;
    return config.getChapterGroup(selectedTopic.slug);
  }, [config.getChapterGroup, selectedTopic.slug]);

  const rawChapters = useMemo(() => {
    if (!isChapterMode) return [];
    if (currentGroup) {
      return currentGroup.topics;
    }
    return selectedTopic.subtopics.map((sub, idx) => ({
      rank: idx + 1,
      title: sub,
      slug: sub.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      priority: "Core",
    }));
  }, [isChapterMode, currentGroup, selectedTopic]);

  const chapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawChapters;
    return rawChapters.filter((ch) => ch.title.toLowerCase().includes(q));
  }, [rawChapters, searchQuery]);

  const selectedChapter = useMemo(() => {
    if (!chapters.length) return null;
    return (
      chapters.find((c) => c.slug === selectedChapterSlug) ||
      chapters[0] ||
      null
    );
  }, [chapters, selectedChapterSlug]);

  const hasStudyMode = STUDY_MODE_TOPICS.has(selectedTopic.slug);

  const targetQuestionTopic = isChapterMode ? (selectedChapter ? selectedChapter.title : selectedTopic.name) : selectedTopic.slug;
  const { counts: modeQuestionCounts } = useQuestionCounts({
    topic: targetQuestionTopic,
    subject: config.subjectId,
  });

  const topicPracticeModes = useMemo(() => {
    return PRACTICE_MODES.map((pm) => {
      const href = isChapterMode
        ? (selectedChapter && currentGroup ? `${config.chapterBasePrefix}/${selectedTopic.slug}/${selectedChapter.slug}/quiz?mode=${pm.mode}` : `${config.chapterBasePrefix}/${selectedTopic.slug}/quiz?mode=${pm.mode}`)
        : `${selectedTopic.routeBase}/quiz?mode=${pm.mode}`;

      if (pm.mode === "ai-challenge" && hasStudyMode && !isChapterMode) {
        return {
          key: "study-mode",
          title: "Study Mode",
          sub: "Interactive study deck",
          mode: "study-mode",
          href: `${selectedTopic.routeBase}/study-mode`,
          icon: Sparkles,
          color: "#7c3aed",
          gradient: "linear-gradient(135deg, #f7f2fe 0%, #ede9fe 100%)",
          gradientDark:
            "linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0.08) 100%)",
          border: "rgba(124, 58, 237, 0.22)",
          borderDark: "rgba(124, 58, 237, 0.35)",
          shadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
        };
      }
      return {
        ...pm,
        href,
      };
    });
  }, [hasStudyMode, selectedTopic.routeBase, PRACTICE_MODES, isChapterMode, selectedChapter, currentGroup, config.chapterBasePrefix, selectedTopic.slug]);

  // Current index in filtered list
  const currentIndex = useMemo(() => {
    return filteredTopics.findIndex((t) => t.id === selectedTopic.id);
  }, [filteredTopics, selectedTopic.id]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TOPICS.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return counts;
  }, [TOPICS]);

  // Stable state ref for keyboard navigation
  const stateRef = useRef({
    currentIndex,
    filteredTopics,
    selectedTopic,
    searchQuery,
    isChapterMode,
    chapters,
    selectedChapter,
    currentGroup,
  });
  useEffect(() => {
    stateRef.current = {
      currentIndex,
      filteredTopics,
      selectedTopic,
      searchQuery,
      isChapterMode,
      chapters,
      selectedChapter,
      currentGroup,
    };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { currentIndex, filteredTopics, selectedTopic, searchQuery, isChapterMode, chapters, selectedChapter, currentGroup } =
        stateRef.current;
      const target = e.target as HTMLElement;
      const isInput = ["INPUT", "TEXTAREA"].includes(target?.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        else target.blur();
        return;
      }

      if (!isInput) {
        if (isChapterMode && chapters.length > 0) {
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            const currentIdx = chapters.findIndex((c) => c.slug === selectedChapter?.slug);
            const nextIdx = (currentIdx + 1) % chapters.length;
            setSelectedChapterSlug(chapters[nextIdx].slug);
          } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            const currentIdx = chapters.findIndex((c) => c.slug === selectedChapter?.slug);
            const prevIdx = (currentIdx - 1 + chapters.length) % chapters.length;
            setSelectedChapterSlug(chapters[prevIdx].slug);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (selectedChapter) {
              const href = currentGroup
                ? `${config.chapterBasePrefix}/${selectedTopic.slug}/${selectedChapter.slug}/quiz?mode=concept`
                : `${config.chapterBasePrefix}/${selectedTopic.slug}/quiz?mode=concept`;
              router.push(href);
            }
          }
        } else if (!isChapterMode && filteredTopics.length > 0) {
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            const nextIdx = (currentIndex + 1) % filteredTopics.length;
            setSelectedTopicId(filteredTopics[nextIdx].id);
          } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            const prevIdx =
              (currentIndex - 1 + filteredTopics.length) % filteredTopics.length;
            setSelectedTopicId(filteredTopics[prevIdx].id);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (selectedTopic) {
              router.push(`${selectedTopic.routeBase}/quiz?mode=concept`);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, config.chapterBasePrefix]);

  const SelectedIcon = selectedTopic.icon;

  return (
    <div className={styles.pageRoot}>
      {/* =========================================================================
          DESKTOP PC VIEW (Zero-Scroll 100vh macOS Studio >= 768px)
          ========================================================================= */}
      <div className={styles.desktopContainer}>
        <div className={styles.macWindow}>
          {/* ── Titlebar & Toolbar (44px) ── */}
          <header className={styles.titlebar}>
            <div className={styles.titlebarLeft}>
              {/* Traffic Lights */}
              <MacTrafficLights
                onClose={() => router.push("/")}
                onMinimize={() => setSidebarOpen((prev) => !prev)}
                onMaximize={() => router.push(`${selectedTopic.routeBase}`)}
              />

              {/* Navigation Arrows */}
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => router.back()}
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft size={13} />
              </button>

              <button
                type="button"
                className={styles.navBtn}
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Toggle Sidebar"
                title="Toggle Sidebar"
              >
                <SidebarIcon size={13} />
              </button>

              {/* Window Title */}
              <div className={styles.windowTitleGroup}>
                <span className={styles.windowIcon} aria-hidden="true">
                  <HubIcon size={14} />
                </span>
                <span className={styles.windowTitle}>
                  {config.label} Studio
                </span>
              </div>
            </div>

            {/* Titlebar Center: Spotlight Search */}
            <div className={styles.titlebarCenter}>
              <div className={styles.searchWrap}>
                <Search size={13} className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={config.searchPlaceholder}
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
                    aria-label="Clear Search"
                  >
                    <X size={9} />
                  </button>
                ) : (
                  <kbd className={styles.searchShortcut}>⌘ K</kbd>
                )}
              </div>
            </div>

            {/* Titlebar Right: View Switchers & Controls */}
            <div className={styles.titlebarRight}>
              {/* Segmented View Mode Control */}
              <div
                className={styles.segmentedControl}
                role="group"
                aria-label="View Mode"
              >
                <button
                  type="button"
                  className={`${styles.segmentedBtn} ${viewMode === "grid" ? styles.segmentedBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid Matrix View"
                  title="Grid Matrix View"
                >
                  <LayoutGrid size={12} />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  className={`${styles.segmentedBtn} ${viewMode === "list" ? styles.segmentedBtnActive : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List Table View"
                  title="List Table View"
                >
                  <ListIcon size={12} />
                  <span>List</span>
                </button>
              </div>

              {/* Dark/Light Theme Toggle */}
              <button
                type="button"
                className={styles.actionBtn}
                onClick={toggleThemeMode}
                aria-label={
                  isDark ? "Switch to Light Mode" : "Switch to Dark Mode"
                }
                title={isDark ? "Light Mode" : "Dark Mode"}
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            </div>
          </header>

          {/* ── 3-Pane Body ── */}
          <div className={styles.windowBody}>
            {/* Left Sidebar (210px) */}
            <aside
              className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarHidden : ""}`}
              aria-label={isChapterMode ? `${config.label} Topics` : `${config.label} Categories`}
            >
              <div className={styles.sidebarSection}>
                {isChapterMode ? (
                  <>
                    <div className={styles.sidebarHeading}>Topics ({TOPICS.length})</div>
                    {TOPICS.map((topic) => {
                      const active = selectedTopic.id === topic.id;
                      const TopicIcon = topic.icon;
                      const group = config.getChapterGroup ? config.getChapterGroup(topic.slug) : null;
                      const chapterCount = group ? group.topics.length : topic.subtopics.length;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ""}`}
                          onClick={() => {
                            setSelectedTopicId(topic.id);
                            setSelectedChapterSlug("");
                          }}
                          title={`${topic.name} (${chapterCount} chapters)`}
                        >
                          <div className={styles.sidebarItemLeft}>
                            <span className={styles.sidebarItemIcon} style={{ color: active ? "#ffffff" : topic.color }}>
                              <TopicIcon size={13} strokeWidth={2.4} />
                            </span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {topic.name}
                            </span>
                          </div>
                          <span className={styles.sidebarItemCount}>{chapterCount}</span>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <div className={styles.sidebarHeading}>Categories</div>
                    {CATEGORIES.map((cat) => {
                      const active = activeCategory === cat.id;
                      const count = categoryCounts[cat.id] || 0;
                      const CatIcon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ""}`}
                          onClick={() => setActiveCategory(cat.id)}
                        >
                          <div className={styles.sidebarItemLeft}>
                            <span className={styles.sidebarItemIcon}>
                              <CatIcon size={12} />
                            </span>
                            <span>{cat.label}</span>
                          </div>
                          <span className={styles.sidebarItemCount}>{count}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </aside>

            {/* Center Canvas: Dense Matrix / List */}
            <main
              className={styles.mainCanvas}
              aria-label={isChapterMode ? `${selectedTopic.name} Chapters` : `${config.label} Topics Matrix`}
            >
              {isChapterMode && (
                <div className={styles.canvasHeader}>
                  <div className={styles.canvasHeaderTitle}>
                    <SelectedIcon size={13} style={{ color: selectedTopic.color }} />
                    <span>{selectedTopic.name} &bull; Chapters</span>
                  </div>
                  <div className={styles.canvasMeta}>
                    <span>{chapters.length} chapters</span>
                    {searchQuery && (
                      <button
                        type="button"
                        className={styles.clearFilterLink}
                        onClick={() => setSearchQuery("")}
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Matrix Viewport */}
              <div className={styles.canvasViewport}>
                {isChapterMode ? (
                  chapters.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyStateIcon}>🔍</div>
                      <div className={styles.emptyStateTitle}>No chapters found</div>
                      <p className={styles.emptyStateDesc}>
                        No chapters in {selectedTopic.name} matched &ldquo;{searchQuery}&rdquo;.
                      </p>
                      <button
                        type="button"
                        className={styles.tableActionBtn}
                        onClick={() => setSearchQuery("")}
                        style={{ marginTop: "8px" }}
                      >
                        Reset Search
                      </button>
                    </div>
                  ) : viewMode === "grid" ? (
                    <div className={styles.denseGrid}>
                      {chapters.map((chapter) => {
                        const isSelected = selectedChapter?.slug === chapter.slug;
                        const ChapterIcon = selectedTopic.icon;
                        const iconColor = selectedTopic.color;
                        const chapterHref = currentGroup
                          ? `${config.chapterBasePrefix}/${selectedTopic.slug}/${chapter.slug}`
                          : `${config.chapterBasePrefix}/${selectedTopic.slug}`;

                        return (
                          <div
                            key={chapter.slug}
                            className={`${styles.compactTile} ${
                              isSelected ? styles.compactTileSelected : ""
                            }`}
                            onClick={() => setSelectedChapterSlug(chapter.slug)}
                            onDoubleClick={() => router.push(chapterHref)}
                            title={`${chapter.title} (Double-click to open)`}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: 6,
                                left: 8,
                                fontSize: 10,
                                fontWeight: 700,
                                color: isSelected ? "var(--mac-blue)" : "var(--mac-text-tertiary)",
                              }}
                            >
                              #{chapter.rank}
                            </div>

                            <div className={styles.tileIconBox}>
                              <ChapterIcon
                                size={20}
                                strokeWidth={2.3}
                                color={isSelected ? "#ffffff" : iconColor}
                                style={{
                                  filter: isSelected
                                    ? undefined
                                    : `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px ${iconColor}80)`,
                                }}
                              />
                            </div>
                            <div className={styles.tileBody}>
                              <span className={styles.tileName} title={chapter.title}>
                                {chapter.title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <table className={styles.denseTable}>
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}>#</th>
                          <th>Chapter Name</th>
                          <th>Priority</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapters.map((chapter) => {
                          const isSelected = selectedChapter?.slug === chapter.slug;
                          const ChapterIcon = selectedTopic.icon;
                          const iconColor = selectedTopic.color;
                          const pBadge = PRIORITY_CONFIG[chapter.priority] || PRIORITY_CONFIG.Core || { badgeBg: "#e2e8f0", badgeColor: "#475569" };
                          const chapterHref = currentGroup
                            ? `${config.chapterBasePrefix}/${selectedTopic.slug}/${chapter.slug}`
                            : `${config.chapterBasePrefix}/${selectedTopic.slug}`;

                          return (
                            <tr
                              key={chapter.slug}
                              className={`${styles.denseTableRow} ${
                                isSelected ? styles.denseTableRowSelected : ""
                              }`}
                              onClick={() => setSelectedChapterSlug(chapter.slug)}
                            >
                              <td>
                                <span style={{ fontWeight: 700, color: "var(--mac-text-tertiary)", fontSize: 11 }}>
                                  #{chapter.rank}
                                </span>
                              </td>
                              <td>
                                <div className={styles.tableTopicCell}>
                                  <div className={styles.tableTopicIcon}>
                                    <ChapterIcon
                                      size={14}
                                      strokeWidth={2.4}
                                      color={iconColor}
                                      style={{
                                        filter: `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 5px ${iconColor}80)`,
                                      }}
                                    />
                                  </div>
                                  <span className={styles.tableTopicName}>{chapter.title}</span>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={styles.tablePriorityBadge}
                                  style={{ background: pBadge.badgeBg, color: pBadge.badgeColor }}
                                >
                                  {chapter.priority}
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "inline-flex", gap: 6 }}>
                                  <Link
                                    href={`${chapterHref}/quiz?mode=concept`}
                                    className={styles.tableActionBtn}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Start Practice Quiz"
                                  >
                                    Practice
                                  </Link>
                                  <Link
                                    href={chapterHref}
                                    className={styles.tableActionBtn}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ background: "transparent", border: "1px solid var(--mac-border)" }}
                                    title="Open Chapter Hub"
                                  >
                                    Hub
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                ) : filteredTopics.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>🔍</div>
                    <div className={styles.emptyStateTitle}>
                      No {config.subjectId} topics found
                    </div>
                    <p className={styles.emptyStateDesc}>
                      No modules matched &ldquo;{searchQuery}&rdquo;.
                    </p>
                    <button
                      type="button"
                      className={styles.tableActionBtn}
                      onClick={() => {
                        setSearchQuery("");
                        setActiveCategory("very-high");
                      }}
                      style={{ marginTop: "8px" }}
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : viewMode === "grid" ? (
                  /* ── Square Monochrome Grid (Click to select) ── */
                  <div className={styles.denseGrid}>
                    {filteredTopics.map((topic) => {
                      const isSelected = selectedTopicId === topic.id;
                      const IconComp = topic.icon;
                      return (
                        <div
                          key={topic.id}
                          className={`${styles.compactTile} ${
                            isSelected ? styles.compactTileSelected : ""
                          }`}
                          onClick={() => setSelectedTopicId(topic.id)}
                        >
                          <div className={styles.tileIconBox}>
                            <IconComp
                              size={22}
                              strokeWidth={2.4}
                              color={topic.color}
                              style={{
                                filter: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px ${topic.color}80)`,
                              }}
                            />
                          </div>
                          <div className={styles.tileBody}>
                            <span
                              className={styles.tileName}
                              title={topic.name}
                            >
                              {topic.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Dense List Table View (Click to select) ── */
                  <table className={styles.denseTable}>
                    <thead>
                      <tr>
                        <th>Topic Name</th>
                        <th>Priority</th>
                        <th>Exam Weight</th>
                        <th>Subtopics</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTopics.map((topic) => {
                        const cfg = PRIORITY_CONFIG[topic.priority];
                        const isSelected = selectedTopicId === topic.id;
                        const IconComp = topic.icon;
                        return (
                          <tr
                            key={topic.id}
                            className={`${styles.denseTableRow} ${
                              isSelected ? styles.denseTableRowSelected : ""
                            }`}
                            onClick={() => setSelectedTopicId(topic.id)}
                          >
                            <td>
                              <div className={styles.tableTopicCell}>
                                <div className={styles.tableTopicIcon}>
                                  <IconComp
                                    size={14}
                                    strokeWidth={2.4}
                                    color={topic.color}
                                    style={{
                                      filter: `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 5px ${topic.color}80)`,
                                    }}
                                  />
                                </div>
                                <span className={styles.tableTopicName}>
                                  {topic.name}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={styles.tablePriorityBadge}
                                style={{
                                  background: cfg.badgeBg,
                                  color: cfg.badgeColor,
                                }}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td>
                              <span className={styles.tableWeightBadge}>
                                {topic.questions} Qs ({topic.expectedMarks})
                              </span>
                            </td>
                            <td>
                              <div
                                className={styles.tableSubtopics}
                                title={topic.subtopics.join(", ")}
                              >
                                {topic.subtopics.join(" • ")}
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Link
                                href={`${topic.routeBase}`}
                                className={styles.tableActionBtn}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </main>

            {/* Right: Live Command Deck (320px) ── */}
            <aside
              className={styles.commandDeck}
              aria-label={isChapterMode ? "Chapter Command Deck" : "Topic Command Deck"}
            >
              {/* ── Hero Topic/Chapter Card ── */}
              <div className={styles.heroCard}>
                <div className={styles.heroCardHeader}>
                  <div className={styles.heroCardIconBox}>
                    <SelectedIcon
                      size={20}
                      strokeWidth={2.4}
                      color={selectedTopic.color}
                      style={{
                        filter: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 8px ${selectedTopic.color}80)`,
                      }}
                    />
                  </div>
                  <div className={styles.heroCardTitleGroup}>
                    <h2 className={styles.heroCardTitle}>
                      {isChapterMode ? (selectedChapter ? selectedChapter.title : selectedTopic.name) : selectedTopic.name}
                    </h2>
                    <span
                      className={styles.heroPriorityPill}
                      style={{
                        background: isChapterMode
                          ? (PRIORITY_CONFIG[selectedChapter?.priority || "Core"]?.badgeBg || "#e2e8f0")
                          : PRIORITY_CONFIG[selectedTopic.priority]?.badgeBg,
                        color: isChapterMode
                          ? (PRIORITY_CONFIG[selectedChapter?.priority || "Core"]?.badgeColor || "#475569")
                          : PRIORITY_CONFIG[selectedTopic.priority]?.badgeColor,
                      }}
                    >
                      {isChapterMode ? (selectedChapter?.priority || "Core") : PRIORITY_CONFIG[selectedTopic.priority]?.label} Priority
                    </span>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className={styles.heroStatsGrid}>
                  <div className={styles.heroStatItem}>
                    <span className={styles.heroStatLabel}>
                      {isChapterMode ? "Chapter Rank" : "Exam Weight"}
                    </span>
                    <span className={styles.heroStatValue}>
                      {isChapterMode ? (selectedChapter ? `#${selectedChapter.rank}` : "Core") : `${selectedTopic.questions} Qs`}
                    </span>
                  </div>
                  <div className={styles.heroStatItem}>
                    <span className={styles.heroStatLabel}>
                      {isChapterMode ? "Topic Chapters" : "Score Potential"}
                    </span>
                    <span className={styles.heroStatValue}>
                      {isChapterMode ? `${rawChapters.length} Total` : selectedTopic.expectedMarks}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Interactive Study Mode Banner (for vocabulary topics) ── */}
              {STUDY_MODE_TOPICS.has(selectedTopic.slug) && (
                <div className={styles.studyModeBannerWrap}>
                  <Link
                    href={`${selectedTopic.routeBase}/study-mode`}
                    className={styles.studyModeBanner}
                    title="Launch Interactive Study Suite"
                  >
                    <div className={styles.studyModeBannerLeft}>
                      <div className={styles.studyModeIconBox}>
                        <BookOpenCheck size={16} strokeWidth={2.4} />
                      </div>
                      <div className={styles.studyModeInfo}>
                        <span className={styles.studyModeKicker}>
                          INTERACTIVE STUDY SUITE
                        </span>
                        <span className={styles.studyModeTitle}>
                          Vocabulary &amp; Flashcards Deck
                        </span>
                        <span className={styles.studyModeSub}>
                          Bilingual Bengali meanings &amp; audio
                        </span>
                      </div>
                    </div>
                    <div className={styles.studyModeLaunchBtn}>
                      <span>Study</span>
                      <ChevronRight size={12} strokeWidth={2.4} />
                    </div>
                  </Link>
                </div>
              )}

              {/* ── Practice Modes (Single Column) ── */}
              <div className={styles.deckSection}>
                <div className={styles.deckSectionHeader}>
                  <span className={styles.deckSectionTitle}>
                    Practice Modes
                  </span>
                  <span className={styles.deckSectionBadge}>6 Modes</span>
                </div>

                <div className={styles.modesList}>
                  {topicPracticeModes.map((pm) => {
                    const ModeIcon = pm.icon;
                    const qCount = modeQuestionCounts[pm.mode] ?? 0;
                    const displayQs = `${qCount} Qs`;
                    return (
                      <Link
                        key={pm.key}
                        href={pm.href}
                        className={styles.modeCard}
                        style={
                          {
                            "--card-gradient": pm.gradient,
                            "--card-gradient-dark": pm.gradientDark,
                            "--card-border": pm.border,
                            "--card-border-dark": pm.borderDark,
                            "--card-accent": pm.color,
                            "--card-shadow": pm.shadow,
                          } as React.CSSProperties
                        }
                        title={`Start ${pm.title}`}
                      >
                        <div className={styles.modeCardLeft}>
                          <div className={styles.modeCardIcon}>
                            <ModeIcon size={14} strokeWidth={2.2} />
                          </div>
                          <div className={styles.modeCardInfo}>
                            <span className={styles.modeCardTitle}>
                              {pm.title}
                            </span>
                            <span className={styles.modeCardSub}>{pm.sub}</span>
                          </div>
                        </div>
                        <div className={styles.modeCardTab} aria-hidden="true">
                          <svg
                            className={styles.tabBgSvg}
                            viewBox="0 0 88 46"
                            preserveAspectRatio="none"
                          >
                            <path
                              d="M28 0 C28 10, 0 13, 0 23 C0 33, 28 36, 28 46 L88 46 L88 0 Z"
                              fill="#ffffff"
                            />
                          </svg>
                          <div className={styles.tabActionIconWrap}>
                            <span className={styles.modeCardQsText}>
                              {displayQs}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* ── Reference & Resources ── */}
              <div className={styles.deckSection} style={{ marginTop: "auto" }}>
                <div className={styles.deckSectionHeader}>
                  <span className={styles.deckSectionTitle}>Resources</span>
                </div>

                <div className={styles.resourceList}>
                  {STUDY_MODE_TOPICS.has(selectedTopic.slug) && !isChapterMode && (
                    <Link
                      href={`${selectedTopic.routeBase}/study-mode`}
                      className={styles.resourceCard}
                      title="Open Interactive Study Suite"
                    >
                      <div className={styles.resourceCardLeft}>
                        <div
                          className={styles.resourceCardIcon}
                          style={{
                            background: "rgba(14, 165, 233, 0.15)",
                            color: "#38bdf8",
                          }}
                        >
                          <BookOpenCheck size={13} strokeWidth={2.2} />
                        </div>
                        <div className={styles.resourceCardInfo}>
                          <span
                            className={styles.resourceCardTitle}
                            style={{ color: "#38bdf8", fontWeight: 650 }}
                          >
                            Interactive Study Mode
                          </span>
                          <span className={styles.resourceCardSub}>
                            Vocabulary cards &amp; audio pronunciation
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        size={13}
                        className={styles.resourceArrow}
                        style={{ color: "#38bdf8" }}
                      />
                    </Link>
                  )}

                  <Link
                    href={isChapterMode && selectedChapter && currentGroup ? `${config.chapterBasePrefix}/${selectedTopic.slug}/${selectedChapter.slug}/formula-notes` : `${selectedTopic.routeBase}/formula-notes`}
                    className={styles.resourceCard}
                    title={`View ${config.notesLabel}`}
                  >
                    <div className={styles.resourceCardLeft}>
                      <div className={styles.resourceCardIcon}>
                        <Sparkles size={13} strokeWidth={2.2} />
                      </div>
                      <div className={styles.resourceCardInfo}>
                        <span className={styles.resourceCardTitle}>
                          {config.notesLabel}
                        </span>
                        <span className={styles.resourceCardSub}>
                          Key shortcuts & cheat sheet
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={13} className={styles.resourceArrow} />
                  </Link>

                  <Link
                    href={isChapterMode && selectedChapter && currentGroup ? `${config.chapterBasePrefix}/${selectedTopic.slug}/${selectedChapter.slug}` : `${selectedTopic.routeBase}`}
                    className={styles.resourceCard}
                    title={isChapterMode && selectedChapter ? "Complete Chapter Hub" : "Complete Module Hub"}
                  >
                    <div className={styles.resourceCardLeft}>
                      <div className={styles.resourceCardIcon}>
                        <BookOpen size={13} strokeWidth={2.2} />
                      </div>
                      <div className={styles.resourceCardInfo}>
                        <span className={styles.resourceCardTitle}>
                          {isChapterMode && selectedChapter ? "Complete Chapter Hub" : "Complete Module Hub"}
                        </span>
                        <span className={styles.resourceCardSub}>
                          {isChapterMode && selectedChapter ? "Syllabus, weightage & deep-dive" : "Deep-dive lessons & notes"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={13} className={styles.resourceArrow} />
                  </Link>

                  {isChapterMode && selectedChapter && currentGroup && (
                    <Link
                      href={`${config.chapterBasePrefix}/${selectedTopic.slug}`}
                      className={styles.resourceCard}
                      title={`Open All ${selectedTopic.name} Chapters`}
                    >
                      <div className={styles.resourceCardLeft}>
                        <div className={styles.resourceCardIcon}>
                          <SelectedIcon size={13} strokeWidth={2.2} />
                        </div>
                        <div className={styles.resourceCardInfo}>
                          <span className={styles.resourceCardTitle}>
                            All {selectedTopic.name} Chapters
                          </span>
                          <span className={styles.resourceCardSub}>
                            Full list of {rawChapters.length} chapters
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={13} className={styles.resourceArrow} />
                    </Link>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (< 768px Handheld Devices)
          ========================================================================= */}
      <div className={styles.mobileContainer}>
        {/* Mobile Topbar */}
        <header className={styles.mobileTopbar}>
          <button
            type="button"
            className={styles.mobileBackBtn}
            onClick={() => router.back()}
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <span className={styles.mobileTopbarTitle}>
            {config.label} Topics
          </span>
          <div style={{ width: 34 }} />
        </header>

        <div className={styles.mobileBody}>
          {/* Search */}
          <div className={styles.mobileSearchRow}>
            <Search className={styles.mobileSearchIcon} size={16} />
            <input
              type="text"
              className={styles.mobileSearchInput}
              placeholder={
                isListening
                  ? "Listening... speak topic"
                  : config.mobileSearchPlaceholder
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search topics"
            />
            <div className={styles.mobileSearchRightActions}>
              {searchQuery && (
                <button
                  type="button"
                  className={styles.mobileSearchClearBtn}
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear Search"
                >
                  <X size={11} />
                </button>
              )}
              <span className={styles.mobileSearchDivider} aria-hidden="true" />
              <button
                type="button"
                className={`${styles.mobileMicBtn} ${isListening ? styles.mobileMicBtnListening : ""}`}
                onClick={toggleVoiceSearch}
                aria-label={isListening ? "Stop voice search" : "Voice search"}
                title={isListening ? "Listening..." : "Voice search"}
              >
                <MicIcon size={16} />
              </button>
            </div>
          </div>

          {/* TOPICS Section Header */}
          <div className={styles.mobileTopicsTitle}>TOPICS</div>

          {/* iOS Grouped Card Container with Filter Header */}
          <div className={styles.mobileTopicGroup}>
            {/* Priority Tabs in Card Header */}
            {!isChapterMode && (
              <div className={styles.mobileTabsScroll}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.mobileTabBtn} ${
                      activeCategory === cat.id ? styles.mobileTabActive : ""
                    }`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {filteredTopics.map((topic) => {
              const TopicIcon = topic.icon;
              return (
                <Link
                  key={topic.id}
                  href={isChapterMode ? `${config.chapterBasePrefix}/${topic.slug}` : `${topic.routeBase}`}
                  className={styles.mobileTopicRow}
                >
                  <div className={styles.mobileTopicRowLeft}>
                    <div
                      className={styles.mobileTopicIconBox}
                      style={{ background: topic.color }}
                    >
                      <TopicIcon size={18} strokeWidth={2.2} color="#ffffff" />
                    </div>

                    <span className={styles.mobileTopicName}>{topic.name}</span>
                  </div>

                  <ChevronRight
                    size={16}
                    strokeWidth={2.4}
                    className={styles.mobileChevron}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
