"use client";
import { useThemeMode } from "@/hooks/useTheme";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { useRef, useState } from "react";

// Shared interaction state; subject-specific chapter/group presentations stay configurable.
export function useSubjectHub() {
  const { theme, toggleThemeMode } = useThemeMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTopicId, setSelectedTopicId] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isListening, toggleVoiceSearch } = useVoiceSearch(setSearchQuery);
  return {
    theme,
    toggleThemeMode,
    isDark: theme === "dark",
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
  };
}
