"use client";

import MacTrafficLights from "@/components/MacTrafficLights";

import { ArrowLeft, BookOpen, BookOpenCheck, ChevronRight, LayoutGrid, List as ListIcon, Moon, Search, Sidebar as SidebarIcon, Sparkles, Sun, X } from "lucide-react";
import Link from "next/link";

import React from "react";

import type { SubjectHubView } from './useSubjectHubView';

export function SubjectHubDesktop({ view }: { view: SubjectHubView }) {
 const { config, TOPICS, CATEGORIES, PRIORITY_CONFIG, HubIcon, STUDY_MODE_TOPICS, styles, router, toggleThemeMode, isDark, searchQuery, setSearchQuery, viewMode, setViewMode, selectedTopicId, setSelectedTopicId, sidebarOpen, setSidebarOpen, searchInputRef, activeCategory, setActiveCategory, setSelectedChapterSlug, isChapterMode, filteredTopics, selectedTopic, currentGroup, rawChapters, chapters, selectedChapter, modeQuestionCounts, topicPracticeModes, categoryCounts, SelectedIcon } = view;
 return (<div className={styles.desktopContainer}>
        <div className={styles.macWindow}>
          {/* ── Titlebar & Toolbar (44px) ── */}
          <header data-ui-chrome="header" className={styles.titlebar}>
            <div className={styles.titlebarLeft}>
              {/* Traffic Lights */}
              <MacTrafficLights
                onClose={() => router.replace("/")}
                onMinimize={() => setSidebarOpen((prev) => !prev)}
                onMaximize={() => router.push(`${selectedTopic.routeBase}`)}
              />

              {/* Navigation Arrows */}
              <button data-ui-button="state" data-ui-shape="icon"
                type="button"
                className={styles.navBtn}
                onClick={() => router.replace("/")}
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft size={13} />
              </button>

              <button data-ui-button="state" data-ui-shape="icon"
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
                  <button data-ui-button="secondary"
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
                <button data-ui-button="state"
                  type="button"
                  className={`${styles.segmentedBtn} ${viewMode === "grid" ? styles.segmentedBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid Matrix View"
                  title="Grid Matrix View"
                >
                  <LayoutGrid size={12} />
                  <span>Grid</span>
                </button>
                <button data-ui-button="state"
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
              <button data-ui-button="secondary"
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
                        <button data-ui-button="state"
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
                        <button data-ui-button="state"
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
                      <button data-ui-button="state"
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
                      <button data-ui-button="state"
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
                           role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
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
                            >
                              <td>
                                <span style={{ fontWeight: 700, color: "var(--mac-text-tertiary)", fontSize: 11 }}>
                                  #{chapter.rank}
                                </span>
                              </td>
                              <td>
                                <button data-ui-button="state"
                                  type="button"
                                  className={styles.tableTopicCell}
                                  onClick={() => setSelectedChapterSlug(chapter.slug)}
                                  aria-pressed={isSelected}
                                  aria-label={`Select ${chapter.title}`}
                                  style={{ width: "100%", padding: 0, border: 0, background: "transparent", color: "inherit", textAlign: "left" }}
                                >
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
                                </button>
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
                                  <Link data-ui-button="secondary"
                                    href={`${chapterHref}/quiz?mode=concept`}
                                    prefetch={false}
                                    className={styles.tableActionBtn}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Start Practice Quiz"
                                    aria-label={`Practice ${chapter.title}`}
                                  >
                                    Practice
                                  </Link>
                                  <Link data-ui-button="secondary"
                                    href={chapterHref}
                                    prefetch={false}
                                    className={styles.tableActionBtn}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ background: "transparent", border: "1px solid var(--mac-border)" }}
                                    title="Open Chapter Hub"
                                    aria-label={`Open ${chapter.title} hub`}
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
                    <button data-ui-button="state"
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
                         role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
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
                          >
                            <td>
                              <button data-ui-button="state"
                                type="button"
                                className={styles.tableTopicCell}
                                onClick={() => setSelectedTopicId(topic.id)}
                                aria-pressed={isSelected}
                                aria-label={`Select ${topic.name}`}
                                style={{ width: "100%", padding: 0, border: 0, background: "transparent", color: "inherit", textAlign: "left" }}
                              >
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
                              </button>
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
                              <Link data-ui-button="secondary"
                                href={`${topic.routeBase}`}
                                prefetch={false}
                                className={styles.tableActionBtn}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Open ${topic.name}`}
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
                    prefetch={false}
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
                        prefetch={false}
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
                      prefetch={false}
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
                    prefetch={false}
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
                    prefetch={false}
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
                      prefetch={false}
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
      </div>);
}
