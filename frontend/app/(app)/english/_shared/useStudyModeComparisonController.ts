'use client';
import { requestResponse as fetch } from "@/shared/api/request";


import { getAccessToken } from "@/shared/api/client";
import { useAppNavigation, useBackLayer } from "@/hooks/useAppNavigation";
import { useThemeMode } from "@/hooks/useTheme";
import { useQuestions } from "@/hooks/useQuestions";
import { useCallback,useDeferredValue,useEffect,useMemo,useRef,useState } from "react";
import {
toStudyModeCard,
type StudyModeCard,
type StudyModeComparisonConfig,
type StudyModeEntry,
} from "./study-mode-comparison-model";


export function useStudyModeComparisonController(config: StudyModeComparisonConfig) {

  const { questions, isLoading: loading, isError: error, mutate: retry } = useQuestions({ subject: 'english', topic: config.topic, questionType: 'study-mode' });
  const cards = useMemo(() => (questions ?? []).map((entry, index) => toStudyModeCard(entry as unknown as StudyModeEntry, index, config)).filter((card): card is StudyModeCard => card !== null).sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' })), [questions, config]);
  const [activeSpeech, setActiveSpeech] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const requestRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const speechWordRef = useRef<string | null>(null);
  const stopSpeech = useCallback(() => {
    requestRef.current?.abort(); requestRef.current = null;
    const audio = audioRef.current;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); }
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null; speechWordRef.current = null;
  }, []);
  useEffect(() => stopSpeech, [stopSpeech]);
  const handleRowClick = async (word: string, translation?: string) => {
    const sameWord = speechWordRef.current === word;
    stopSpeech();
    if (sameWord) { setActiveSpeech(null); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    speechWordRef.current = word;
    setActiveSpeech(word);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Authentication required');
      const res = await fetch('/api/tts', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ text: word.trim(), bengaliText: translation?.trim() }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      const finish = () => { if (!controller.signal.aborted) { stopSpeech(); setActiveSpeech(null); } };
      audio.onended = finish; audio.onerror = finish;
      await audio.play();
    } catch {
      if (!controller.signal.aborted) { stopSpeech(); setActiveSpeech(null); }
    }
  };

  const navigation = useAppNavigation();
  const { theme, setThemeMode } = useThemeMode();
  const setTheme = (value: string | ((current: string) => string)) => setThemeMode((typeof value === 'function' ? value(theme) : value) === 'light' ? 'light' : 'dark');

  const [page, setPage] = useState(1);
  const setCurrentPage = useCallback((value: number | ((current: number) => number)) => {
    stopSpeech(); setActiveSpeech(null); setPage(value);
  }, [stopSpeech]);
  const [searchQuery, updateSearchQuery] = useState("");
  const setSearchQuery = (value: string) => { updateSearchQuery(value); setCurrentPage(1); };
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const deferredSearch = searchQuery.trim() ? deferredQuery : '';
  const [viewMode, setViewMode] = useState<"all" | "primary" | "secondary">("all");
  const [mobileTab, setMobileTab] = useState<"primary" | "secondary">("primary");

  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [mobileSheetSearch, setMobileSheetSearch] = useState("");
  const [mobileSheetLetter, setMobileSheetLetter] = useState<string | null>(null);
  const [selectedLetter, updateSelectedLetter] = useState<string | null>(null);
  const setSelectedLetter = (value: string | null) => { updateSelectedLetter(value); setCurrentPage(1); };
  const [stagedLetter, setStagedLetter] = useState<string | null>(null);
  const [isLetterDropdownOpen, setIsLetterDropdownOpen] = useState(false);

  const indexedCards = useMemo(() => cards.map(card => ({ card, search: [card.word, ...card.meanings.flatMap(meaning => [meaning.definition, meaning.translation]), ...card.primaryItems.map(item => item.word), ...card.secondaryItems.map(item => item.word)].filter(Boolean).join(' ').toLowerCase() })), [cards]);
  const filteredCards = useMemo(() => indexedCards.filter(({ card, search }) => (!deferredSearch || search.includes(deferredSearch)) && (!selectedLetter || card.word[0]?.toUpperCase() === selectedLetter)).map(({ card }) => card), [indexedCards, deferredSearch, selectedLetter]);
  const currentPage = Math.min(Math.max(page, 1), Math.max(filteredCards.length, 1));
  const selectCard = (id: string) => {
    const index = cards.findIndex(card => card.id === id);
    updateSearchQuery(''); updateSelectedLetter(null);
    setCurrentPage(index < 0 ? 1 : index + 1);
    setIsMobilePaletteOpen(false);
  };
  useBackLayer(isLetterDropdownOpen, () => setIsLetterDropdownOpen(false));
  useBackLayer(isMobilePaletteOpen, () => setIsMobilePaletteOpen(false));
  useBackLayer(showExitConfirm, () => setShowExitConfirm(false));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);



  // Desktop Keyboard navigation & Cmd+F Search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        const input = isMobilePaletteOpen ? document.querySelector<HTMLInputElement>('.modal-search-input') : searchInputRef.current;
        if (input?.offsetParent) { e.preventDefault(); input.focus(); }
        return;
      }
      if (isMobilePaletteOpen || showExitConfirm || isLetterDropdownOpen) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === "ArrowLeft" && currentPage > 1) {
        e.preventDefault(); setCurrentPage(currentPage - 1);
      } else if (e.key === "ArrowRight" && currentPage < filteredCards.length) {
        e.preventDefault(); setCurrentPage(currentPage + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, filteredCards.length, isMobilePaletteOpen, showExitConfirm, isLetterDropdownOpen, setCurrentPage]);

  // Close letter dropdown when clicking outside
  useEffect(() => {
    if (!isLetterDropdownOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.letter-filter-wrapper')) setIsLetterDropdownOpen(false);
    };
    // Pointer events cover touch, pen, and mouse dismissal.
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [isLetterDropdownOpen]);

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    navigation.replace(`/english/${config.topic}/study-mode`);
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

  const sheetSearch = useDeferredValue(mobileSheetSearch.trim().toLowerCase());
  const filteredSheetCards = useMemo(() => indexedCards.filter(({ card, search }) => (!sheetSearch || search.includes(sheetSearch)) && (!mobileSheetLetter || card.word[0]?.toUpperCase() === mobileSheetLetter)).map(({ card }) => card), [indexedCards, sheetSearch, mobileSheetLetter]);


  return {
    cards,
    loading,
    error,
    retry,
    selectCard,
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
    filteredCards,
    searchInputRef,
    touchStartXRef,
    touchStartYRef,
    handleConfirmExit,
    availableLetters,
    filteredSheetCards,
  };
}
