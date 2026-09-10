'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/axios";
import { useStudyModeEngine } from "./useStudyModeEngine";
import {
  toStudyModeCard,
  type StudyModeCard,
  type StudyModeComparisonConfig,
  type StudyModeEntry,
} from "./study-mode-comparison-model";

export function useStudyModeComparisonController(config: StudyModeComparisonConfig) {

  const { cards, loading } = useStudyModeEngine<StudyModeCard>({ topic: config.topic, normalize: (entry, index) => toStudyModeCard(entry as unknown as StudyModeEntry, index, config), fallback: [config.demoCard], compare: (a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }) });
  const [activeSpeech, setActiveSpeech] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleRowClick = async (word: string, translation?: string) => {
    if (activeSpeech === word && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setActiveSpeech(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setActiveSpeech(word);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error("Authentication required");
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          text: word.trim(),
          bengaliText: translation ? translation.trim() : undefined
        }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setActiveSpeech(null); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = () => { setActiveSpeech(null); URL.revokeObjectURL(url); audioRef.current = null; };
      await audio.play();
    } catch {
      setActiveSpeech(null);
    }
  };

  const router = useRouter();
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedTheme = window.localStorage.getItem("study-mode-theme");
        if (savedTheme === "light" || savedTheme === "dark") {
          setTheme(savedTheme);
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("study-mode-theme", theme);
    } catch {}
  }, [theme]);


  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "primary" | "secondary">("all");
  const [mobileTab, setMobileTab] = useState<"primary" | "secondary">("primary");

  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [mobileSheetSearch, setMobileSheetSearch] = useState("");
  const [mobileSheetLetter, setMobileSheetLetter] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [stagedLetter, setStagedLetter] = useState<string | null>(null);
  const [isLetterDropdownOpen, setIsLetterDropdownOpen] = useState(false);

  const [mobileSheetVisibleCount, setMobileSheetVisibleCount] = useState(50);
  useEffect(() => {
    const timer = window.setTimeout(() => setMobileSheetVisibleCount(50), 0);
    return () => window.clearTimeout(timer);
  }, [mobileSheetSearch, mobileSheetLetter]);

  // Filter cards by search + selected letter (memoized)
  const filteredCards = useMemo(
    () =>
      cards.filter((c) => {
        const matchSearch = c.word.toLowerCase().includes(searchQuery.toLowerCase());
        const matchLetter = !selectedLetter || c.word[0]?.toUpperCase() === selectedLetter;
        return matchSearch && matchLetter;
      }),
    [cards, searchQuery, selectedLetter]
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);



  useEffect(() => {
    if (cards.length > 0 && currentPage > cards.length) {
      const timer = window.setTimeout(() => setCurrentPage(cards.length), 0);
      return () => window.clearTimeout(timer);
    }
  }, [cards.length, currentPage]);

  // Default to Synonyms tab whenever navigating between words
  useEffect(() => {
    const timer = window.setTimeout(() => setMobileTab("primary"), 0);
    return () => window.clearTimeout(timer);
  }, [currentPage]);

  // Desktop Keyboard navigation & Cmd+F Search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (showExitConfirm) {
          setShowExitConfirm(false);
          return;
        }
        if (isMobilePaletteOpen) {
          setIsMobilePaletteOpen(false);
          return;
        }
      }
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
        return;
      }
      if (e.key === "ArrowLeft" && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else if (e.key === "ArrowRight" && currentPage < filteredCards.length) {
        setCurrentPage((prev) => prev + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, filteredCards.length]);

  // Close letter dropdown when clicking outside
  useEffect(() => {
    if (!isLetterDropdownOpen) return;
    const close = (e: MouseEvent) => {
      // ignore clicks inside the wrapper (handled by stopPropagation on the wrapper div)
      setIsLetterDropdownOpen(false);
    };
    // Use mousedown so it fires before the button's onClick can re-open
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [isLetterDropdownOpen]);

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    router.replace(`/english/${config.topic}`);
  };

  // Derive the set of letters that actually exist in the word list (memoized)
  // MUST be before any conditional return to obey Rules of Hooks
  const availableLetters = useMemo(
    () =>
      Array.from(
        new Set(cards.map((c) => c.word[0]?.toUpperCase()).filter(Boolean))
      ).sort(),
    [cards]
  );

  // Derived filtered cards for the mobile full-page filter modal
  const filteredSheetCards = useMemo(() => {
    const q = mobileSheetSearch.trim().toLowerCase();
    return cards.filter((c) => {
      const matchSearch =
        !q ||
        c.word.toLowerCase().includes(q) ||
        c.meanings.some(
          (m) =>
            m.translation?.toLowerCase().includes(q) ||
            m.definition?.toLowerCase().includes(q)
        );
      const matchLetter =
        !mobileSheetLetter || c.word[0]?.toUpperCase() === mobileSheetLetter;
      return matchSearch && matchLetter;
    });
  }, [cards, mobileSheetSearch, mobileSheetLetter]);

  // If filteredCards changes and currentPage is out of bounds, adjust it
  useEffect(() => {
    if (filteredCards.length > 0 && currentPage > filteredCards.length) {
      const timer = window.setTimeout(() => setCurrentPage(1), 0);
      return () => window.clearTimeout(timer);
    }
  }, [filteredCards.length, currentPage]);

  // Scroll to active card when mobile palette opens
  useEffect(() => {
    if (isMobilePaletteOpen) {
      const activeCardFallback = filteredCards[Math.min(currentPage - 1, Math.max(0, filteredCards.length - 1))];
      if (activeCardFallback) {
        const activeIdx = filteredSheetCards.findIndex(c => c.id === activeCardFallback.id);
        if (activeIdx !== -1) {
          let visibleCountTimer: number | undefined;
          // Ensure visible count includes the active index + some buffer
          if (activeIdx >= mobileSheetVisibleCount) {
            visibleCountTimer = window.setTimeout(
              () => setMobileSheetVisibleCount(activeIdx + 20),
              0,
            );
          }

          // Wait for DOM to render the new count, then scroll
          const scrollTimer = window.setTimeout(() => {
            const activeEl = document.querySelector('.modal-word-item.active');
            if (activeEl) {
              activeEl.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
          }, 50);
          return () => {
            if (visibleCountTimer !== undefined) window.clearTimeout(visibleCountTimer);
            window.clearTimeout(scrollTimer);
          };
        }
      }
    }
  }, [isMobilePaletteOpen]); // Only run when palette open state changes


  return {
    cards,
    loading,
    activeSpeech,
    handleRowClick,
    theme,
    setTheme,
    currentPage,
    setCurrentPage,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    mobileTab,
    setMobileTab,
    isMobilePaletteOpen,
    setIsMobilePaletteOpen,
    showExitConfirm,
    setShowExitConfirm,
    mobileSheetSearch,
    setMobileSheetSearch,
    mobileSheetLetter,
    setMobileSheetLetter,
    selectedLetter,
    setSelectedLetter,
    stagedLetter,
    setStagedLetter,
    isLetterDropdownOpen,
    setIsLetterDropdownOpen,
    mobileSheetVisibleCount,
    setMobileSheetVisibleCount,
    filteredCards,
    searchInputRef,
    touchStartXRef,
    touchStartYRef,
    handleConfirmExit,
    availableLetters,
    filteredSheetCards,
  };
}
