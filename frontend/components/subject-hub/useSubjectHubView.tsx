"use client";
import { useSubjectHub } from "@/components/subject-hub/useSubjectHub";

import defaultStyles from "@/components/SubjectHub.module.css";
import { useQuestionCounts } from "@/hooks/useQuestionCounts";
import { Sparkles } from "lucide-react";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SubjectHubConfig } from "./types";

const EMPTY_STUDY_TOPICS = new Set<string>();
type SubjectHubSort = "default" | "questions-desc" | "questions-asc" | "alpha";

export function useSubjectHubView({ config, enableDesktop = false }: { config: SubjectHubConfig; enableDesktop?: boolean }) {
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
const [activeCategory, setActiveCategory] = useState<string>("very-high");
const [selectedChapterSlug, setSelectedChapterSlug] = useState<string>("");
const [mobileCategory, setMobileCategory] = useState("all");
const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
const [sortBy, setSortBy] = useState<SubjectHubSort>("default");
const [sortMenuOpen, setSortMenuOpen] = useState(false);
const sortOptions: Array<{ id: SubjectHubSort; label: string }> = [
    { id: "default", label: "Default" },
    { id: "questions-desc", label: "Most questions" },
    { id: "questions-asc", label: "Least questions" },
    { id: "alpha", label: "A → Z" },
  ];
const oledMobile = config.mobileAppearance === "oled";
const mobileStyles = oledMobile ? defaultStyles : styles;
const mobileTopics = useMemo(() => {
    if (!oledMobile) return null;
    const query = searchQuery.trim().toLowerCase();
    const filtered = TOPICS.filter((topic) => {
      return (
        (mobileCategory === "all" || topic.priority === mobileCategory) &&
        (!query ||
          [topic.name, topic.description, ...topic.subtopics].some((text) =>
            text.toLowerCase().includes(query)
          ))
      );
    });

    if (sortBy === "questions-desc") {
      return [...filtered].sort(
        (a, b) =>
          (config.mobileTopicDetails?.[b.slug]?.questionCount ?? 0) -
          (config.mobileTopicDetails?.[a.slug]?.questionCount ?? 0)
      );
    }
    if (sortBy === "questions-asc") {
      return [...filtered].sort(
        (a, b) =>
          (config.mobileTopicDetails?.[a.slug]?.questionCount ?? 0) -
          (config.mobileTopicDetails?.[b.slug]?.questionCount ?? 0)
      );
    }
    if (sortBy === "alpha") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered;
  }, [oledMobile, TOPICS, searchQuery, mobileCategory, sortBy, config.mobileTopicDetails]);
const isChapterMode = !!config.getChapterGroup;
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
const selectedTopic = useMemo(() => {
    return (
      filteredTopics.find((t) => t.id === selectedTopicId) ||
      filteredTopics[0] ||
      TOPICS[0]
    );
  }, [selectedTopicId, filteredTopics, TOPICS]);
const currentGroup = useMemo(() => {
    if (!config.getChapterGroup) return null;
    return config.getChapterGroup(selectedTopic.slug);
  }, [config, selectedTopic.slug]);
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
    enabled: enableDesktop,
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
const currentIndex = useMemo(() => {
    return filteredTopics.findIndex((t) => t.id === selectedTopic.id);
  }, [filteredTopics, selectedTopic.id]);
const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TOPICS.forEach((t) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return counts;
  }, [TOPICS]);
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
  }, [router, config.chapterBasePrefix, searchInputRef, setSearchQuery, setSelectedTopicId]);
const SelectedIcon = selectedTopic.icon;
return { config, TOPICS, CATEGORIES, PRIORITY_CONFIG, PRACTICE_MODES, HubIcon, STUDY_MODE_TOPICS, styles, router, toggleThemeMode, isDark, searchQuery, setSearchQuery, viewMode, setViewMode, selectedTopicId, setSelectedTopicId, sidebarOpen, setSidebarOpen, searchInputRef, isListening, toggleVoiceSearch, activeCategory, setActiveCategory, selectedChapterSlug, setSelectedChapterSlug, mobileCategory, setMobileCategory, mobileFilterOpen, setMobileFilterOpen, sortBy, setSortBy, sortMenuOpen, setSortMenuOpen, sortOptions, oledMobile, mobileStyles, mobileTopics, isChapterMode, filteredTopics, selectedTopic, currentGroup, rawChapters, chapters, selectedChapter, hasStudyMode, targetQuestionTopic, modeQuestionCounts, topicPracticeModes, currentIndex, categoryCounts, stateRef, SelectedIcon };
}
export type SubjectHubView = ReturnType<typeof useSubjectHubView>;
