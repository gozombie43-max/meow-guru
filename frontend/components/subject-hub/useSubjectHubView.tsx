"use client";

import defaultStyles from "@/components/SubjectHub.module.css";
import { useRecentTopic } from "@/lib/recent-study";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SubjectHubConfig } from "./types";

type SubjectHubSort = "default" | "questions-desc" | "questions-asc" | "alpha";

const SORT_OPTIONS: Array<{ id: SubjectHubSort; label: string }> = [
  { id: "default", label: "Default" },
  { id: "questions-desc", label: "Most questions" },
  { id: "questions-asc", label: "Least questions" },
  { id: "alpha", label: "A → Z" },
];

export function useSubjectHubView({ config }: { config: SubjectHubConfig }) {
  const {
    topics: TOPICS,
    categories: CATEGORIES,
    icon: HubIcon,
  } = config;

  const styles = useMemo(
    () => (config.styles ? { ...defaultStyles, ...config.styles } : defaultStyles),
    [config.styles]
  );
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileCategory, setMobileCategory] = useState("all");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SubjectHubSort>("default");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const recentTopicSlug = useRecentTopic(config.subjectId);

  const mobileTopics = useMemo(() => {
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
    if (recentTopicSlug) {
      const recentIndex = filtered.findIndex((t) => t.slug === recentTopicSlug);
      if (recentIndex > 0) {
        const next = [...filtered];
        const [recentItem] = next.splice(recentIndex, 1);
        next.unshift(recentItem);
        return next;
      }
    }
    return filtered;
  }, [TOPICS, searchQuery, mobileCategory, sortBy, config.mobileTopicDetails, recentTopicSlug]);

  const isChapterMode = Boolean(config.getChapterGroup);

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subtopics.some((s) => s.toLowerCase().includes(q)) ||
        t.description.toLowerCase().includes(q)
    );
  }, [searchQuery, TOPICS]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
        } else {
          (e.target as HTMLElement | null)?.blur?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery]);

  return {
    config,
    TOPICS,
    CATEGORIES,
    HubIcon,
    styles,
    router,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    mobileCategory,
    setMobileCategory,
    mobileFilterOpen,
    setMobileFilterOpen,
    sortBy,
    setSortBy,
    sortMenuOpen,
    setSortMenuOpen,
    sortOptions: SORT_OPTIONS,
    recentTopicSlug,
    mobileTopics,
    isChapterMode,
    filteredTopics,
  };
}

export type SubjectHubView = ReturnType<typeof useSubjectHubView>;
